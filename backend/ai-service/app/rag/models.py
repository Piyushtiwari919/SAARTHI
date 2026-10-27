"""Data models and schemas for RAG indexing, retrieval, and source-grounded answering."""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class RAGStatus(str, Enum):
    ANSWERED = "ANSWERED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    NOT_INDEXED = "NOT_INDEXED"
    ERROR = "ERROR"


@dataclass
class DocumentChunk:
    """Represents a text chunk strictly bounded within a single document page."""

    chunk_id: str
    document_id: str
    document_title: str
    page_number: int  # 1-based, strictly preserved from source page
    chunk_text: str
    content_hash: str
    indexing_version: str = "v1"


@dataclass
class RetrievedChunk:
    """Represents a chunk retrieved from the vector store with similarity scoring."""

    chunk: DocumentChunk
    relevance_score: float  # Normalized cosine relevance [0.0, 1.0]
    distance: float


class SourceCitation(BaseModel):
    """Source reference with validated document and page provenance."""

    document_id: str
    document_title: str
    page_number: int
    chunk_id: str
    snippet: str
    relevance_score: Optional[float] = None


class RAGQueryRequest(BaseModel):
    """Request payload for source-grounded question answering."""

    document_id: str = Field(..., description="Target indexed scholarship notice document ID")
    question: str = Field(..., min_length=3, max_length=1000, description="User's query")
    top_k: Optional[int] = Field(default=None, ge=1, le=15, description="Number of passages to retrieve")


class RAGQueryResponse(BaseModel):
    """Response payload containing grounded answer and verified citations."""

    status: RAGStatus
    question: str
    answer: str
    sources: List[SourceCitation] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    document_id: str
    document_title: Optional[str] = None


class RAGIndexResponse(BaseModel):
    """Response payload returned upon completing document indexing."""

    status: str = "INDEXED"
    document_id: str
    document_title: str
    chunk_count: int
    page_count: int
    indexing_version: str = "v1"
    warnings: List[str] = Field(default_factory=list)

