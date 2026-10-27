"""Persistent Vector Store abstraction using ChromaDB.

Provides persistent storage, collection isolation, idempotent indexing,
strict document-level filtering, and similarity scoring.
"""

import abc
import logging
import os
from typing import Dict, List, Optional

# Disable ChromaDB telemetry completely to prevent socket/DNS thread delays in sandboxed environments
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from chromadb.config import Settings as ChromaSettings

from app.rag.models import DocumentChunk, RetrievedChunk

logger = logging.getLogger(__name__)


class NoOpEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    No-op embedding function.
    Prevents ChromaDB from downloading default ONNX models over the network,
    as embeddings are generated explicitly by our application embedding provider.
    """

    def __init__(self):
        pass

    def name(self) -> str:
        return "noop"

    def __call__(self, input: Documents) -> Embeddings:
        return []


class BaseVectorStore(abc.ABC):
    """Abstract interface for RAG vector storage."""

    @abc.abstractmethod
    def add_chunks(
        self,
        collection_name: str,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
    ) -> int:
        """Store chunks and vectors idempotently. Returns count of added chunks."""
        pass

    @abc.abstractmethod
    def query(
        self,
        collection_name: str,
        query_embedding: List[float],
        top_k: int,
        filter_document_id: str,
    ) -> List[RetrievedChunk]:
        """Search vector index restricted strictly to filter_document_id."""
        pass

    @abc.abstractmethod
    def delete_document(self, collection_name: str, document_id: str) -> int:
        """Purge all chunks associated with document_id."""
        pass

    @abc.abstractmethod
    def is_document_indexed(self, collection_name: str, document_id: str) -> bool:
        """Check if document currently has stored chunks in the collection."""
        pass

    @abc.abstractmethod
    def get_document_chunks(self, collection_name: str, document_id: str) -> List[DocumentChunk]:
        """Retrieve all stored chunks for a specific document."""
        pass


class ChromaVectorStore(BaseVectorStore):
    """
    Persistent vector store powered by ChromaDB.
    Persists data on disk across restarts; supports isolated collections and metadata filtering.
    """

    def __init__(self, persist_directory: str = "./chroma_data"):
        self.persist_directory = persist_directory
        os.makedirs(self.persist_directory, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False, is_persistent=True),
        )
        self._noop_fn = NoOpEmbeddingFunction()

    def _get_or_create_collection(self, collection_name: str):
        # Use cosine similarity space and custom no-op embedding function to prevent network calls
        return self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
            embedding_function=self._noop_fn,
        )

    def add_chunks(
        self,
        collection_name: str,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
    ) -> int:
        if not chunks:
            return 0

        if len(chunks) != len(embeddings):
            raise ValueError(f"Chunks count ({len(chunks)}) does not match embeddings count ({len(embeddings)})")

        collection = self._get_or_create_collection(collection_name)

        # Idempotency: first delete any existing chunks for this document
        doc_id = chunks[0].document_id
        self.delete_document(collection_name, doc_id)

        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[Dict[str, str | int]] = []

        for chunk in chunks:
            ids.append(chunk.chunk_id)
            documents.append(chunk.chunk_text)
            metadatas.append({
                "document_id": chunk.document_id,
                "document_title": chunk.document_title,
                "page_number": int(chunk.page_number),
                "content_hash": chunk.content_hash,
                "indexing_version": chunk.indexing_version,
            })

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(
            "Indexed %d chunks for document '%s' in collection '%s'",
            len(chunks),
            doc_id,
            collection_name,
        )
        return len(chunks)

    def query(
        self,
        collection_name: str,
        query_embedding: List[float],
        top_k: int,
        filter_document_id: str,
    ) -> List[RetrievedChunk]:
        collection = self._get_or_create_collection(collection_name)

        # Enforce strict document isolation: query is strictly constrained to filter_document_id
        where_filter = {"document_id": filter_document_id}

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        retrieved: List[RetrievedChunk] = []

        ids_list = results.get("ids", [[]])[0]
        docs_list = results.get("documents", [[]])[0]
        metas_list = results.get("metadatas", [[]])[0]
        dists_list = results.get("distances", [[]])[0] if results.get("distances") else []

        for idx, chunk_id in enumerate(ids_list):
            doc_text = docs_list[idx] if idx < len(docs_list) else ""
            meta = metas_list[idx] if idx < len(metas_list) else {}
            dist = dists_list[idx] if idx < len(dists_list) else 1.0

            # Cosine distance to similarity: similarity = 1.0 - distance
            # Clamped to [0.0, 1.0]
            similarity = max(0.0, min(1.0, 1.0 - dist))

            chunk = DocumentChunk(
                chunk_id=chunk_id,
                document_id=str(meta.get("document_id", filter_document_id)),
                document_title=str(meta.get("document_title", "Scholarship Notice")),
                page_number=int(meta.get("page_number", 1)),
                chunk_text=doc_text,
                content_hash=str(meta.get("content_hash", "")),
                indexing_version=str(meta.get("indexing_version", "v1")),
            )

            retrieved.append(RetrievedChunk(chunk=chunk, relevance_score=similarity, distance=dist))

        # Sort by highest relevance score
        retrieved.sort(key=lambda x: x.relevance_score, reverse=True)
        return retrieved

    def delete_document(self, collection_name: str, document_id: str) -> int:
        collection = self._get_or_create_collection(collection_name)
        existing = collection.get(where={"document_id": document_id})
        count = len(existing.get("ids", []))
        if count > 0:
            collection.delete(where={"document_id": document_id})
            logger.info("Deleted %d chunks for document '%s'", count, document_id)
        return count

    def is_document_indexed(self, collection_name: str, document_id: str) -> bool:
        collection = self._get_or_create_collection(collection_name)
        existing = collection.get(where={"document_id": document_id}, limit=1)
        return bool(existing.get("ids"))

    def get_document_chunks(self, collection_name: str, document_id: str) -> List[DocumentChunk]:
        collection = self._get_or_create_collection(collection_name)
        results = collection.get(
            where={"document_id": document_id},
            include=["documents", "metadatas"],
        )

        chunks: List[DocumentChunk] = []
        ids = results.get("ids", [])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])

        for idx, chunk_id in enumerate(ids):
            meta = metas[idx] if idx < len(metas) else {}
            chunk = DocumentChunk(
                chunk_id=chunk_id,
                document_id=str(meta.get("document_id", document_id)),
                document_title=str(meta.get("document_title", "")),
                page_number=int(meta.get("page_number", 1)),
                chunk_text=docs[idx] if idx < len(docs) else "",
                content_hash=str(meta.get("content_hash", "")),
                indexing_version=str(meta.get("indexing_version", "v1")),
            )
            chunks.append(chunk)

        # Sort by page number then chunk id
        chunks.sort(key=lambda c: (c.page_number, c.chunk_id))
        return chunks

