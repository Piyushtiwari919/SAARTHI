"""Embedding provider integration for RAG.

Provides:
- BaseEmbeddingProvider abstract interface
- GeminiEmbeddingProvider using the official google-genai SDK (text-embedding-004)
  with separate RETRIEVAL_DOCUMENT and RETRIEVAL_QUERY task types.
- MockEmbeddingProvider generating deterministic unit-normalized vectors for offline tests.
"""

import abc
import asyncio
import hashlib
import logging
import math
from typing import List, Optional

from app.core.config import Settings
from app.utils.file_validation import DocumentServiceException

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_DIM = 768


class BaseEmbeddingProvider(abc.ABC):
    """Abstract interface for text embedding generation."""

    @property
    @abc.abstractmethod
    def dimension(self) -> int:
        """Vector dimensionality."""
        pass

    @abc.abstractmethod
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for document chunks (task: RETRIEVAL_DOCUMENT)."""
        pass

    @abc.abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a query question (task: RETRIEVAL_QUERY)."""
        pass


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Embedding provider utilizing Google GenAI SDK.
    Uses official task_type flags: RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for questions.
    """

    def __init__(self, settings: Settings, client=None):
        self.settings = settings
        self._client = client
        self._dimension = DEFAULT_EMBEDDING_DIM

    @property
    def dimension(self) -> int:
        return self._dimension

    def _get_client(self):
        if self._client is not None:
            return self._client
        if not self.settings.is_gemini_configured():
            raise DocumentServiceException(
                error_code="EMBEDDING_PROVIDER_UNCONFIGURED",
                message="Gemini embedding provider requested but GEMINI_API_KEY is not configured.",
                status_code=503,
            )
        try:
            from google import genai
            self._client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
            return self._client
        except Exception as exc:
            logger.error("Failed to initialize Google GenAI embedding client: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="EMBEDDING_INITIALIZATION_FAILED",
                message="Failed to initialize AI embedding client",
                status_code=500,
            ) from exc

    def _call_embed_sync(self, client, texts: List[str], task_type: str) -> List[List[float]]:
        from google.genai import types

        model = self.settings.GEMINI_EMBEDDING_MODEL
        results: List[List[float]] = []

        # Process in batches of 16 to respect provider payload limits
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            response = client.models.embed_content(
                model=model,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                ),
            )

            if not response or not hasattr(response, "embeddings") or not response.embeddings:
                raise DocumentServiceException(
                    error_code="MALFORMED_EMBEDDING_RESPONSE",
                    message="Provider returned empty or malformed embedding response",
                    status_code=502,
                )

            for emb in response.embeddings:
                values = emb.values if hasattr(emb, "values") else emb
                if not values or len(values) == 0:
                    raise DocumentServiceException(
                        error_code="MALFORMED_EMBEDDING_RESPONSE",
                        message="Provider returned invalid vector values",
                        status_code=502,
                    )
                results.append(list(values))

        return results

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        client = self._get_client()
        try:
            vectors = await asyncio.wait_for(
                asyncio.to_thread(self._call_embed_sync, client, texts, "RETRIEVAL_DOCUMENT"),
                timeout=self.settings.PROVIDER_TIMEOUT_SECONDS,
            )
            return vectors
        except asyncio.TimeoutError as te:
            logger.error("Embedding provider timed out after %.1f s", self.settings.PROVIDER_TIMEOUT_SECONDS)
            raise DocumentServiceException(
                error_code="EMBEDDING_PROVIDER_TIMEOUT",
                message="AI embedding generation timed out",
                status_code=504,
            ) from te
        except DocumentServiceException:
            raise
        except Exception as exc:
            logger.error("Embedding provider call failed: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="EMBEDDING_GENERATION_FAILED",
                message="Failed to generate document embeddings",
                status_code=502,
            ) from exc

    async def embed_query(self, text: str) -> List[float]:
        if not text or not text.strip():
            raise DocumentServiceException(
                error_code="INVALID_QUERY",
                message="Query text cannot be empty",
                status_code=400,
            )

        client = self._get_client()
        try:
            vectors = await asyncio.wait_for(
                asyncio.to_thread(self._call_embed_sync, client, [text], "RETRIEVAL_QUERY"),
                timeout=self.settings.PROVIDER_TIMEOUT_SECONDS,
            )
            return vectors[0]
        except asyncio.TimeoutError as te:
            logger.error("Query embedding timed out after %.1f s", self.settings.PROVIDER_TIMEOUT_SECONDS)
            raise DocumentServiceException(
                error_code="EMBEDDING_PROVIDER_TIMEOUT",
                message="Query embedding generation timed out",
                status_code=504,
            ) from te
        except DocumentServiceException:
            raise
        except Exception as exc:
            logger.error("Query embedding call failed: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="EMBEDDING_GENERATION_FAILED",
                message="Failed to generate query embedding",
                status_code=502,
            ) from exc


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Deterministic embedding generator for unit and integration testing.
    Produces unit-normalized vectors derived from text n-grams and hashing.
    Enables semantic similarity testing without external network or API keys.
    """

    def __init__(self, dim: int = DEFAULT_EMBEDDING_DIM):
        self._dim = dim

    @property
    def dimension(self) -> int:
        return self._dim

    def _generate_vector(self, text: str) -> List[float]:
        # Generate pseudo-semantic vector from words
        words = text.lower().split()
        vec = [0.0] * self._dim

        for word in words:
            # Deterministic bucket per word
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self._dim
            vec[idx] += 1.0

            # Secondary cross-term bucket
            idx2 = (h >> 4) % self._dim
            vec[idx2] += 0.5

        # Also add a slight baseline from overall text hash to prevent zero vectors
        text_h = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
        vec[text_h % self._dim] += 0.2

        # L2 normalize vector
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]

    async def embed_query(self, text: str) -> List[float]:
        return self._generate_vector(text)

