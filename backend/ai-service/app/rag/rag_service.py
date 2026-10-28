"""RAG Orchestration Service.

Coordinates:
- Page-preserving document loading and chunking
- Embedding generation
- Persistent vector storage and retrieval with document isolation
- Grounded answer generation
- Citation validation and snippet extraction
"""

import logging
from typing import List, Optional

from app.core.config import Settings
from app.rag.chunker import PagePreservingChunker
from app.rag.embeddings import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider,
)
from app.rag.generator import (
    BaseAnswerGenerator,
    DeterministicAnswerGenerator,
    GeminiAnswerGenerator,
)
from app.rag.models import (
    DocumentChunk,
    RAGIndexResponse,
    RAGQueryRequest,
    RAGQueryResponse,
    RAGStatus,
    RetrievedChunk,
    SourceCitation,
)
from app.rag.vector_store import BaseVectorStore, ChromaVectorStore
from app.services.document_loader import DocumentLoaderService
from app.utils.file_validation import DocumentServiceException, validate_pdf_structure

logger = logging.getLogger(__name__)

SCHOLARSHIP_COLLECTION = "scholarship_notices"


class RAGService:
    """End-to-end service for indexing scholarship notices and answering source-grounded questions."""

    def __init__(
        self,
        settings: Settings,
        document_loader: DocumentLoaderService,
        vector_store: Optional[BaseVectorStore] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        generator: Optional[BaseAnswerGenerator] = None,
    ):
        self.settings = settings
        self.document_loader = document_loader
        self.chunker = PagePreservingChunker()

        # Initialize vector store
        self.vector_store = vector_store or ChromaVectorStore(
            persist_directory=self.settings.CHROMA_PERSIST_DIR
        )

        # Resolve embedding provider
        if embedding_provider is not None:
            self.embedding_provider = embedding_provider
        elif self.settings.AI_PROVIDER == "gemini" and self.settings.is_gemini_configured():
            self.embedding_provider = GeminiEmbeddingProvider(self.settings)
        else:
            self.embedding_provider = MockEmbeddingProvider()

        # Resolve answer generator
        if generator is not None:
            self.generator = generator
        elif self.settings.AI_PROVIDER == "gemini" and self.settings.is_gemini_configured():
            self.generator = GeminiAnswerGenerator(self.settings)
        else:
            self.generator = DeterministicAnswerGenerator()

    async def index_document(
        self,
        document_id: str,
        document_title: str,
        file_bytes: bytes,
        file_format: str,
        category: str,
    ) -> RAGIndexResponse:
        """
        Extract, chunk, embed, and persistently store a scholarship notice.
        Enforces category restriction: only SCHOLARSHIP_NOTICE is permitted for RAG.
        """
        # Strict scope enforcement: only SCHOLARSHIP_NOTICE documents are eligible
        norm_cat = category.strip().upper()
        if norm_cat not in ("SCHOLARSHIP_NOTICE", "SCHOLARSHIP_DOCUMENT"):
            raise DocumentServiceException(
                error_code="UNSUPPORTED_RAG_DOCUMENT_TYPE",
                message=f"Category '{category}' is not eligible for RAG indexing. Only SCHOLARSHIP_NOTICE documents can be indexed.",
                status_code=400,
            )

        # Validate PDF structure if PDF
        if file_format == "pdf":
            validate_pdf_structure(file_bytes, max_pages=self.settings.MAX_PDF_PAGES)

        # 1. Load document and extract page text
        loaded_doc = self.document_loader.load_document(file_bytes, file_format)
        if not loaded_doc.pages:
            raise DocumentServiceException(
                error_code="EMPTY_DOCUMENT",
                message="No usable text could be extracted from the document for indexing",
                status_code=422,
            )

        # 2. Split into page-preserving chunks
        chunks = self.chunker.chunk_pages(
            document_id=document_id,
            document_title=document_title,
            pages=loaded_doc.pages,
        )

        if not chunks:
            raise DocumentServiceException(
                error_code="INDEXING_FAILED",
                message="Document contained insufficient extractable text to generate search passages",
                status_code=422,
            )

        # 3. Generate embeddings for chunks
        chunk_texts = [c.chunk_text for c in chunks]
        embeddings = await self.embedding_provider.embed_documents(chunk_texts)

        # 4. Store persistently in vector index (idempotent: deletes old chunks for document_id first)
        added_count = self.vector_store.add_chunks(
            collection_name=SCHOLARSHIP_COLLECTION,
            chunks=chunks,
            embeddings=embeddings,
        )

        return RAGIndexResponse(
            status="INDEXED",
            document_id=document_id,
            document_title=document_title,
            chunk_count=added_count,
            page_count=loaded_doc.page_count,
            warnings=loaded_doc.warnings,
        )

    async def query_document(
        self,
        request: RAGQueryRequest,
    ) -> RAGQueryResponse:
        """
        Execute RAG query against an authorized scholarship notice.
        1. Checks if document is indexed (returns NOT_INDEXED if not).
        2. Generates query embedding and retrieves top-k chunks.
        3. Enforces relevance threshold.
        4. Synthesizes grounded answer.
        5. Validates and attaches citations.
        """
        document_id = request.document_id
        question = request.question.strip()
        top_k = request.top_k or self.settings.RAG_TOP_K

        # 1. Check if document is indexed
        is_indexed = self.vector_store.is_document_indexed(
            collection_name=SCHOLARSHIP_COLLECTION,
            document_id=document_id,
        )

        if not is_indexed:
            return RAGQueryResponse(
                status=RAGStatus.NOT_INDEXED,
                question=question,
                answer="The selected scholarship notice has not been indexed for question answering yet. Please index it first.",
                sources=[],
                warnings=["Document has not been indexed in vector storage"],
                document_id=document_id,
            )

        # 2. Embed query
        query_vector = await self.embedding_provider.embed_query(question)

        # 3. Retrieve chunks with strict document isolation
        retrieved_chunks = self.vector_store.query(
            collection_name=SCHOLARSHIP_COLLECTION,
            query_embedding=query_vector,
            top_k=top_k,
            filter_document_id=document_id,
        )

        # 4. Filter by relevance threshold
        relevant_chunks: List[RetrievedChunk] = [
            rc for rc in retrieved_chunks if rc.relevance_score >= self.settings.RAG_RELEVANCE_THRESHOLD
        ]

        document_title = (
            retrieved_chunks[0].chunk.document_title if retrieved_chunks else "Scholarship Notice"
        )

        if not relevant_chunks:
            logger.info("No chunks passed relevance threshold (%.2f) for question", self.settings.RAG_RELEVANCE_THRESHOLD)
            return RAGQueryResponse(
                status=RAGStatus.INSUFFICIENT_EVIDENCE,
                question=question,
                answer="I could not find sufficient supporting evidence in the selected scholarship notice for your question.",
                sources=[],
                warnings=["No retrieved passages exceeded relevance threshold"],
                document_id=document_id,
                document_title=document_title,
            )

        # 5. Generate grounded answer
        generator_output = await self.generator.generate_answer(
            question=question,
            retrieved_chunks=relevant_chunks,
            document_title=document_title,
        )

        # 6. Validate citations against actual retrieved set
        retrieved_map = {rc.chunk.chunk_id: rc for rc in relevant_chunks}
        validated_sources: List[SourceCitation] = []

        for cid in generator_output.cited_chunk_ids:
            if cid in retrieved_map:
                rc = retrieved_map[cid]
                # Extract clean snippet (first 180 characters of chunk)
                snippet_text = rc.chunk.chunk_text.strip()
                if len(snippet_text) > 180:
                    snippet_text = snippet_text[:177] + "..."
                validated_sources.append(
                    SourceCitation(
                        document_id=rc.chunk.document_id,
                        document_title=rc.chunk.document_title,
                        page_number=rc.chunk.page_number,
                        chunk_id=rc.chunk.chunk_id,
                        snippet=snippet_text,
                        relevance_score=round(rc.relevance_score, 4),
                    )
                )

        # Fallback: if answered but model didn't include cited_chunk_ids, attach top relevant chunk
        if generator_output.status == RAGStatus.ANSWERED and not validated_sources and relevant_chunks:
            top_rc = relevant_chunks[0]
            snippet_text = top_rc.chunk.chunk_text.strip()
            if len(snippet_text) > 180:
                snippet_text = snippet_text[:177] + "..."
            validated_sources.append(
                SourceCitation(
                    document_id=top_rc.chunk.document_id,
                    document_title=top_rc.chunk.document_title,
                    page_number=top_rc.chunk.page_number,
                    chunk_id=top_rc.chunk.chunk_id,
                    snippet=snippet_text,
                    relevance_score=round(top_rc.relevance_score, 4),
                )
            )

        final_status = generator_output.status
        if final_status == RAGStatus.INSUFFICIENT_EVIDENCE:
            validated_sources = []

        return RAGQueryResponse(
            status=final_status,
            question=question,
            answer=generator_output.answer,
            sources=validated_sources,
            warnings=generator_output.warnings,
            document_id=document_id,
            document_title=document_title,
        )

    def delete_document(self, document_id: str) -> int:
        """Purge indexed chunks when document is deleted."""
        return self.vector_store.delete_document(
            collection_name=SCHOLARSHIP_COLLECTION,
            document_id=document_id,
        )

    def is_document_indexed(self, document_id: str) -> bool:
        """Check if document has stored chunks in vector store."""
        return self.vector_store.is_document_indexed(
            collection_name=SCHOLARSHIP_COLLECTION,
            document_id=document_id,
        )

