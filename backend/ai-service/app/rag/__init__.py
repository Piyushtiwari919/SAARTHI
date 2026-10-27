"""RAG module for Saarthi AI Service."""

from app.rag.chunker import PagePreservingChunker
from app.rag.embeddings import BaseEmbeddingProvider, GeminiEmbeddingProvider, MockEmbeddingProvider
from app.rag.generator import BaseAnswerGenerator, DeterministicAnswerGenerator, GeminiAnswerGenerator
from app.rag.models import (
    DocumentChunk,
    RAGIndexResponse,
    RAGQueryRequest,
    RAGQueryResponse,
    RAGStatus,
    RetrievedChunk,
    SourceCitation,
)
from app.rag.rag_service import RAGService
from app.rag.vector_store import BaseVectorStore, ChromaVectorStore

__all__ = [
    "BaseAnswerGenerator",
    "BaseEmbeddingProvider",
    "BaseVectorStore",
    "ChromaVectorStore",
    "DeterministicAnswerGenerator",
    "DocumentChunk",
    "GeminiAnswerGenerator",
    "GeminiEmbeddingProvider",
    "MockEmbeddingProvider",
    "PagePreservingChunker",
    "RAGIndexResponse",
    "RAGQueryRequest",
    "RAGQueryResponse",
    "RAGService",
    "RAGStatus",
    "RetrievedChunk",
    "SourceCitation",
]

