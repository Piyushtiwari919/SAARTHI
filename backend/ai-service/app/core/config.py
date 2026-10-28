"""Application configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for Saarthi AI Document Intelligence Service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Environment
    ENVIRONMENT: Literal["development", "test", "production"] = "development"

    # Service-to-service auth token between Node.js worker/backend and FastAPI
    INTERNAL_SERVICE_TOKEN: str = Field(
        default="",
        description="Shared secret for authenticating internal requests from Node.js",
    )

    # Provider configuration
    AI_PROVIDER: Literal["local", "gemini"] = Field(
        default="local",
        description="Active AI extraction and RAG provider",
    )
    GEMINI_API_KEY: str = Field(
        default="",
        description="Google Gemini API key (optional, only used when AI_PROVIDER=gemini)",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Google Gemini text generation model identifier",
    )
    GEMINI_EMBEDDING_MODEL: str = Field(
        default="text-embedding-004",
        description="Google Gemini embedding model identifier",
    )
    PROVIDER_TIMEOUT_SECONDS: float = Field(
        default=30.0,
        description="Maximum seconds to wait for AI provider calls",
    )

    # Document upload limits
    MAX_UPLOAD_BYTES: int = Field(
        default=10 * 1024 * 1024,  # 10 MB
        description="Maximum allowed upload file size in bytes",
    )
    MAX_PDF_PAGES: int = Field(
        default=10,
        description="Maximum allowed PDF page count",
    )

    # OCR configuration
    OCR_ENABLED: bool = Field(
        default=True,
        description="Enable OCR for scanned PDFs and image files",
    )
    TESSERACT_CMD: str = Field(
        default="",
        description="Custom path to tesseract executable (especially on Windows)",
    )

    # RAG Vector Store & Retrieval Configuration
    CHROMA_PERSIST_DIR: str = Field(
        default="./chroma_data",
        description="Directory path for persistent ChromaDB vector storage",
    )
    RAG_TOP_K: int = Field(
        default=5,
        description="Default number of relevant chunks to retrieve for RAG",
    )
    RAG_RELEVANCE_THRESHOLD: float = Field(
        default=0.35,
        description="Minimum cosine relevance score threshold to consider a chunk relevant",
    )

    def is_gemini_configured(self) -> bool:
        """Check if Gemini provider is configured with an API key."""
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip())

    def __repr__(self) -> str:
        """Mask sensitive values to prevent leaking secrets in logs or debug displays."""
        return (
            f"Settings("
            f"ENVIRONMENT='{self.ENVIRONMENT}', "
            f"AI_PROVIDER='{self.AI_PROVIDER}', "
            f"INTERNAL_SERVICE_TOKEN='***' if set else '', "
            f"GEMINI_API_KEY='***' if set else '', "
            f"GEMINI_MODEL='{self.GEMINI_MODEL}', "
            f"GEMINI_EMBEDDING_MODEL='{self.GEMINI_EMBEDDING_MODEL}', "
            f"CHROMA_PERSIST_DIR='{self.CHROMA_PERSIST_DIR}', "
            f"MAX_UPLOAD_BYTES={self.MAX_UPLOAD_BYTES}, "
            f"MAX_PDF_PAGES={self.MAX_PDF_PAGES}, "
            f"OCR_ENABLED={self.OCR_ENABLED}"
            f")"
        )


@lru_cache
def get_settings() -> Settings:
    """Retrieve cached application settings instance."""
    return Settings()
