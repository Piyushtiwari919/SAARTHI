"""End-to-End verification of document extraction, RAG indexing, and source-grounded Q&A."""

import os
import shutil
import pytest
import asyncio
from app.core.config import Settings
from app.rag.models import RAGQueryRequest, RAGStatus
from app.rag.rag_service import RAGService
from app.services.document_loader import DocumentLoaderService
from app.services.extraction_service import ExtractionService
from app.services.ocr_service import OCRService
from app.schemas.extraction import DocumentType
from app.utils.file_validation import DocumentServiceException

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
NOTICE_PATH = os.path.join(FIXTURES_DIR, "synthetic_scholarship_notice.pdf")
INCOME_PATH = os.path.join(FIXTURES_DIR, "synthetic_income_certificate.pdf")

async def run_e2e_pipeline(chroma_dir: str):
    settings = Settings(
        ENVIRONMENT="test",
        INTERNAL_SERVICE_TOKEN="test_e2e_secret_token",
        AI_PROVIDER="local",
        CHROMA_PERSIST_DIR=chroma_dir,
        OCR_ENABLED=True,
    )

    # Setup services
    ocr_service = OCRService(settings)
    doc_loader = DocumentLoaderService(settings, ocr_service)
    extraction_service = ExtractionService(settings, doc_loader)
    rag_service = RAGService(settings, doc_loader)

    with open(NOTICE_PATH, "rb") as f:
        notice_bytes = f.read()

    with open(INCOME_PATH, "rb") as f:
        income_bytes = f.read()

    # 1. Test Structured Extraction on Scholarship Notice
    loaded_notice = doc_loader.load_document(notice_bytes, "pdf")
    pages_notice = loaded_notice.pages
    assert len(pages_notice) == 2, f"Expected 2 pages in notice, got {len(pages_notice)}"

    provider = extraction_service._resolve_provider()
    res_notice = await provider.extract(DocumentType.SCHOLARSHIP_NOTICE, pages_notice)
    field_map_notice = {f.field: f for f in res_notice.extracted_fields}

    # Verify deadline extracted from Page 1
    assert "application_deadline" in field_map_notice
    deadline_f = field_map_notice["application_deadline"]
    assert deadline_f.value == "2026-12-31"
    assert deadline_f.source_page == 1

    # Verify rules extracted from Page 2
    assert res_notice.eligibility_rules is not None
    rules = res_notice.eligibility_rules
    pct_rule = next(r for r in rules if r.field == "minimum_percentage")
    assert pct_rule.expected_value == 60.0
    assert pct_rule.source_page == 2

    inc_rule = next(r for r in rules if r.field == "annual_income")
    assert inc_rule.expected_value == 250000
    assert inc_rule.source_page == 2

    print("[PASS] Step 1: Page-preserving structured extraction succeeded!")

    # 2. Test Privacy Guard: Income certificate must be rejected from RAG indexing
    try:
        await rag_service.index_document(
            document_id="doc_income_01",
            document_title="Income Proof",
            file_bytes=income_bytes,
            file_format="pdf",
            category="INCOME_CERTIFICATE",
        )
        assert False, "Income certificate should have been rejected from RAG indexing!"
    except DocumentServiceException as exc:
        assert exc.error_code == "UNSUPPORTED_RAG_DOCUMENT_TYPE"
        assert exc.status_code == 400
        print("[PASS] Step 2: Privacy guard successfully blocked indexing of sensitive income proof!")

    # 3. Test RAG Indexing of Scholarship Notice
    index_res = await rag_service.index_document(
        document_id="doc_notice_01",
        document_title="National Merit Scholarship Circular 2026",
        file_bytes=notice_bytes,
        file_format="pdf",
        category="SCHOLARSHIP_NOTICE",
    )
    assert index_res.status == "INDEXED"
    assert index_res.document_id == "doc_notice_01"
    assert index_res.chunk_count >= 2
    assert index_res.page_count == 2
    print(f"[PASS] Step 3: RAG notice indexed successfully ({index_res.chunk_count} passages across {index_res.page_count} pages)!")

    # 4. Test RAG Grounded Querying with exact citations
    # Q1: Minimum percentage
    q1 = RAGQueryRequest(
        document_id="doc_notice_01",
        question="What is the minimum percentage required to be eligible?",
    )
    ans1 = await rag_service.query_document(q1)
    assert ans1.status == RAGStatus.ANSWERED
    assert len(ans1.sources) > 0
    # Must cite Page 2 where the minimum percentage is defined
    assert any(s.page_number == 2 for s in ans1.sources), f"Expected citation on page 2, got: {ans1.sources}"
    print(f"[PASS] Step 4a: Q1 answered with verified citation on Page 2! Answer: {ans1.answer[:60]}...")

    # Q2: Application deadline
    q2 = RAGQueryRequest(
        document_id="doc_notice_01",
        question="When is the application deadline?",
    )
    ans2 = await rag_service.query_document(q2)
    assert ans2.status == RAGStatus.ANSWERED
    assert len(ans2.sources) > 0
    # Must cite Page 1 where the deadline is stated
    assert any(s.page_number == 1 for s in ans2.sources), f"Expected citation on page 1, got: {ans2.sources}"
    print(f"[PASS] Step 4b: Q2 answered with verified citation on Page 1! Answer: {ans2.answer[:60]}...")

    # Q3: Unanswerable Question (not present in document)
    q3 = RAGQueryRequest(
        document_id="doc_notice_01",
        question="What is the reservation quota percentage for international sports medalists?",
    )
    ans3 = await rag_service.query_document(q3)
    assert ans3.status == RAGStatus.INSUFFICIENT_EVIDENCE
    assert "sufficient" in ans3.answer.lower()
    print("[PASS] Step 4c: Unanswerable question correctly returned INSUFFICIENT_EVIDENCE status!")

if __name__ == "__main__":
    test_chroma = os.path.join(os.path.dirname(__file__), "test_chroma_db")
    if os.path.exists(test_chroma):
        try:
            shutil.rmtree(test_chroma, ignore_errors=True)
        except:
            pass

    asyncio.run(run_e2e_pipeline(test_chroma))
    print("\n========================================================")
    print("ALL 5 END-TO-END RAG PIPELINE CHECKS PASSED PERFECTLY!")
    print("========================================================")
