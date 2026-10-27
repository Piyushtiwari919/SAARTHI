"""Base extraction provider interface and result dataclasses."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

from app.schemas.extraction import (
    DocumentType,
    EligibilityRule,
    ExtractedField,
)
from app.services.document_loader import PageContent


@dataclass
class ProviderExtractionResult:
    """Standardized result returned by extraction providers."""

    extracted_fields: List[ExtractedField]
    eligibility_rules: Optional[List[EligibilityRule]]
    warnings: List[str]
    provider_used: str


class BaseExtractionProvider(ABC):
    """Abstract base class for extraction providers."""

    @abstractmethod
    async def extract(
        self,
        document_type: DocumentType,
        pages: List[PageContent],
    ) -> ProviderExtractionResult:
        """
        Extract structured fields from document pages.

        Args:
            document_type: Category of the document (INCOME_CERTIFICATE, SCHOLARSHIP_NOTICE).
            pages: List of PageContent objects with 1-based page numbers and extracted text.

        Returns:
            ProviderExtractionResult containing extracted fields, rules, and warnings.
        """
        pass

