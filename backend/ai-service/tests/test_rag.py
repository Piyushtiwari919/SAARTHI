"""Deterministic unit and API tests for RAG indexing, retrieval, and source-grounded answering."""

import io
import shutil
import tempfile
import pytest
from httpx import AsyncClient, ASGITransport

from app.core.config import Settings
from app.main import app
from app.rag.chunker import PagePreservingChunker
from app.rag.embeddings import MockEmbeddingProvider
from app.rag.generator import DeterministicAnswerGenerator, GeneratorOutput
from app.rag.models import (
    DocumentChunk,
    RAGQueryRequest,
    RAGStatus,
    RetrievedChunk,
)
from app.rag.rag_service import RAGService
from app.rag.vector_store import ChromaVectorStore
from app.services.document_loader import DocumentLoaderService, PageContent
from app.services.ocr_service import OCRService
from app.utils.file_validation import DocumentServiceException


@pytest.fixture
def temp_chroma_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def test_settings(temp_chroma_dir):
    return Settings(
        ENVIRONMENT="test",
        INTERNAL_SERVICE_TOKEN="test_secret_token_123",
        AI_PROVIDER="local",
        CHROMA_PERSIST_DIR=temp_chroma_dir,
        RAG_TOP_K=3,
        RAG_RELEVANCE_THRESHOLD=0.1,
    )


@pytest.fixture
def rag_service(test_settings):
    ocr_service = OCRService(test_settings)
    doc_loader = DocumentLoaderService(test_settings, ocr_service)
    vector_store = ChromaVectorStore(persist_directory=test_settings.CHROMA_PERSIST_DIR)
    embed_provider = MockEmbeddingProvider(dim=128)
    generator = DeterministicAnswerGenerator()
    return RAGService(
        settings=test_settings,
        document_loader=doc_loader,
        vector_store=vector_store,
        embedding_provider=embed_provider,
        generator=generator,
    )


# =========================================================================
# 1. Page-Preserving Chunking Tests
# =========================================================================

def test_page_preserving_chunker_retains_page_numbers():
    chunker = PagePreservingChunker(chunk_size=150, chunk_overlap=30)
    pages = [
        PageContent(
            page_number=1,
            text="Central Sector Scheme for College and University Students. Applications open annually.",
            status="TEXT_EXTRACTED",
        ),
        PageContent(
            page_number=2,
            text="Eligibility Criteria: Minimum 80th percentile in Class 12 board examination. Annual family income must not exceed Rs 4,50,000 per annum.",
            status="TEXT_EXTRACTED",
        ),
        PageContent(
            page_number=3,
            text="Required Documents: Aadhaar Card, Income Certificate, College Admission Proof, Bank Passbook.",
            status="TEXT_EXTRACTED",
        ),
    ]

    chunks = chunker.chunk_pages(
        document_id="doc_sch_01",
        document_title="Central Sector Scheme Notice",
        pages=pages,
    )

    assert len(chunks) >= 3
    # Verify no chunk bridges multiple pages
    page_1_chunks = [c for c in chunks if c.page_number == 1]
    page_2_chunks = [c for c in chunks if c.page_number == 2]
    page_3_chunks = [c for c in chunks if c.page_number == 3]

    assert len(page_1_chunks) >= 1
    assert len(page_2_chunks) >= 1
    assert len(page_3_chunks) >= 1

    # Verify fields on every chunk
    for c in chunks:
        assert c.document_id == "doc_sch_01"
        assert c.document_title == "Central Sector Scheme Notice"
        assert c.indexing_version == "v1"
        assert len(c.content_hash) > 0
        assert c.chunk_id.startswith("doc_sch_01_p")


def test_chunker_skips_unusable_pages():
    chunker = PagePreservingChunker()
    pages = [
        PageContent(page_number=1, text="", status="NO_USABLE_TEXT"),
        PageContent(page_number=2, text="Valid text content for page two.", status="TEXT_EXTRACTED"),
    ]
    chunks = chunker.chunk_pages("doc_02", "Title", pages)
    assert len(chunks) == 1
    assert chunks[0].page_number == 2


# =========================================================================
# 2. Vector Store Idempotency & Document Isolation
# =========================================================================

def test_vector_store_idempotent_indexing(temp_chroma_dir):
    store = ChromaVectorStore(persist_directory=temp_chroma_dir)
    chunks_v1 = [
        DocumentChunk(
            chunk_id="doc_test_p1_c0",
            document_id="doc_test",
            document_title="Test Notice",
            page_number=1,
            chunk_text="Initial version text",
            content_hash="hash1",
        )
    ]
    vecs_v1 = [[0.1] * 128]

    # Index first time
    added_1 = store.add_chunks("test_coll", chunks_v1, vecs_v1)
    assert added_1 == 1
    assert store.is_document_indexed("test_coll", "doc_test") is True

    # Re-index same document with updated text
    chunks_v2 = [
        DocumentChunk(
            chunk_id="doc_test_p1_c0_v2",
            document_id="doc_test",
            document_title="Test Notice Updated",
            page_number=1,
            chunk_text="Updated version text",
            content_hash="hash2",
        )
    ]
    vecs_v2 = [[0.2] * 128]

    added_2 = store.add_chunks("test_coll", chunks_v2, vecs_v2)
    assert added_2 == 1

    # Verify no duplicate old chunks exist
    stored_chunks = store.get_document_chunks("test_coll", "doc_test")
    assert len(stored_chunks) == 1
    assert stored_chunks[0].chunk_text == "Updated version text"


def test_query_isolation_between_documents(temp_chroma_dir):
    store = ChromaVectorStore(persist_directory=temp_chroma_dir)
    provider = MockEmbeddingProvider(dim=128)

    # Document A
    chunk_a = DocumentChunk(
        chunk_id="doc_a_p1_c0",
        document_id="doc_a",
        document_title="Scholarship A",
        page_number=1,
        chunk_text="The application deadline for Scholarship A is October 31, 2026.",
        content_hash="ha",
    )
    # Document B
    chunk_b = DocumentChunk(
        chunk_id="doc_b_p1_c0",
        document_id="doc_b",
        document_title="Scholarship B",
        page_number=1,
        chunk_text="The application deadline for Scholarship B is December 15, 2026.",
        content_hash="hb",
    )

    vecs = [
        provider._generate_vector(chunk_a.chunk_text),
        provider._generate_vector(chunk_b.chunk_text),
    ]

    store.add_chunks("test_isolation", [chunk_a], [vecs[0]])
    store.add_chunks("test_isolation", [chunk_b], [vecs[1]])

    query_vec = provider._generate_vector("application deadline")

    # Query strictly doc_a
    results_a = store.query("test_isolation", query_vec, top_k=5, filter_document_id="doc_a")
    assert len(results_a) == 1
    assert results_a[0].chunk.document_id == "doc_a"
    assert "Scholarship A" in results_a[0].chunk.chunk_text

    # Query strictly doc_b
    results_b = store.query("test_isolation", query_vec, top_k=5, filter_document_id="doc_b")
    assert len(results_b) == 1
    assert results_b[0].chunk.document_id == "doc_b"
    assert "Scholarship B" in results_b[0].chunk.chunk_text


# =========================================================================
# 3. Grounded Answer Synthesis & Citation Verification
# =========================================================================

@pytest.mark.asyncio
async def test_rag_service_query_answered_with_citations(rag_service):
    # Index synthetic scholarship notice
    doc_id = "sch_notice_101"
    chunks = [
        DocumentChunk(
            chunk_id="sch_notice_101_p1_c0",
            document_id=doc_id,
            document_title="National Merit Scholarship Circular",
            page_number=1,
            chunk_text="National Merit Scholarship 2026-2027. Application deadline is November 30, 2026.",
            content_hash="h1",
        ),
        DocumentChunk(
            chunk_id="sch_notice_101_p2_c0",
            document_id=doc_id,
            document_title="National Merit Scholarship Circular",
            page_number=2,
            chunk_text="Family income limit: Gross annual income of parents must not exceed Rs 6,00,000.",
            content_hash="h2",
        ),
    ]
    texts = [c.chunk_text for c in chunks]
    vecs = await rag_service.embedding_provider.embed_documents(texts)
    rag_service.vector_store.add_chunks("scholarship_notices", chunks, vecs)

    # 1. Ask answerable question
    res = await rag_service.query_document(
        RAGQueryRequest(
            document_id=doc_id,
            question="What is the family income limit?",
        )
    )

    assert res.status == RAGStatus.ANSWERED
    assert "6,00,000" in res.answer or "income" in res.answer.lower()
    assert len(res.sources) > 0
    assert res.sources[0].document_id == doc_id
    assert res.sources[0].page_number == 2
    assert "Rs 6,00,000" in res.sources[0].snippet


@pytest.mark.asyncio
async def test_rag_service_unsupported_question_returns_insufficient_evidence(rag_service):
    doc_id = "sch_notice_102"
    chunks = [
        DocumentChunk(
            chunk_id="sch_notice_102_p1_c0",
            document_id=doc_id,
            document_title="Engineering Scholarship",
            page_number=1,
            chunk_text="Eligible branches: Computer Science, Mechanical Engineering, Electrical Engineering.",
            content_hash="h1",
        )
    ]
    texts = [c.chunk_text for c in chunks]
    vecs = await rag_service.embedding_provider.embed_documents(texts)
    rag_service.vector_store.add_chunks("scholarship_notices", chunks, vecs)

    # Ask unanswerable question about sports quota
    res = await rag_service.query_document(
        RAGQueryRequest(
            document_id=doc_id,
            question="What is the sports quota qualification for archery?",
        )
    )

    assert res.status == RAGStatus.INSUFFICIENT_EVIDENCE
    assert len(res.sources) == 0


@pytest.mark.asyncio
async def test_rag_service_unindexed_document_returns_not_indexed(rag_service):
    res = await rag_service.query_document(
        RAGQueryRequest(
            document_id="unindexed_doc_999",
            question="What is the deadline?",
        )
    )
    assert res.status == RAGStatus.NOT_INDEXED
    assert len(res.sources) == 0


@pytest.mark.asyncio
async def test_rag_rejects_personal_income_certificate_for_indexing(rag_service):
    with pytest.raises(DocumentServiceException) as exc_info:
        await rag_service.index_document(
            document_id="inc_cert_01",
            document_title="Personal Income Certificate",
            file_bytes=b"%PDF-1.4...",
            file_format="pdf",
            category="INCOME_CERTIFICATE",
        )
    assert exc_info.value.error_code == "UNSUPPORTED_RAG_DOCUMENT_TYPE"
    assert exc_info.value.status_code == 400


# =========================================================================
# 4. Internal FastAPI Route Authentication & Integration Tests
# =========================================================================

@pytest.mark.asyncio
async def test_internal_rag_endpoints_reject_unauthenticated_requests():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Query without token
        res_query = await client.post(
            "/internal/v1/rag/query",
            json={"document_id": "doc_123", "question": "What is the criteria?"},
        )
        assert res_query.status_code == 401

        # 2. Status without token
        res_status = await client.get("/internal/v1/rag/status/doc_123")
        assert res_status.status_code == 401


@pytest.mark.asyncio
async def test_internal_rag_query_with_valid_token(test_settings):
    from app.core.config import get_settings
    app.dependency_overrides[get_settings] = lambda: test_settings

    try:
        transport = ASGITransport(app=app)
        headers = {"X-Internal-Service-Token": test_settings.INTERNAL_SERVICE_TOKEN}

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Query unindexed document -> returns NOT_INDEXED status cleanly with 200
            res = await client.post(
                "/internal/v1/rag/query",
                json={"document_id": "test_not_indexed_doc", "question": "What are the rules?"},
                headers=headers,
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "NOT_INDEXED"
    finally:
        app.dependency_overrides.clear()
