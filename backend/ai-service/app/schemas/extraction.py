"""Extraction schemas and enumerations."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    """Supported document types for extraction."""

    INCOME_CERTIFICATE = "INCOME_CERTIFICATE"
    SCHOLARSHIP_NOTICE = "SCHOLARSHIP_NOTICE"
    MARKSHEET = "MARKSHEET"
    BONAFIDE_CERTIFICATE = "BONAFIDE_CERTIFICATE"
    DOMICILE_CERTIFICATE = "DOMICILE_CERTIFICATE"
    CASTE_CERTIFICATE = "CASTE_CERTIFICATE"
    IDENTITY_PROOF = "IDENTITY_PROOF"
    BANK_DOCUMENT = "BANK_DOCUMENT"
    ADMISSION_LETTER = "ADMISSION_LETTER"
    FEE_RECEIPT = "FEE_RECEIPT"
    OTHER = "OTHER"


class FieldExtractionStatus(str, Enum):
    """Status of an individual extracted field."""

    EXTRACTED = "EXTRACTED"
    NOT_FOUND = "NOT_FOUND"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ProcessingStatus(str, Enum):
    """Overall processing status for the document."""

    COMPLETED = "COMPLETED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    FAILED = "FAILED"


class RuleOperator(str, Enum):
    """Strict allowlist for scholarship eligibility rule operators."""

    EQ = "EQ"
    NE = "NE"
    GT = "GT"
    GTE = "GTE"
    LT = "LT"
    LTE = "LTE"
    IN = "IN"
    NOT_IN = "NOT_IN"


class ExtractedField(BaseModel):
    """Model representing an extracted field with provenance and status."""

    field: str = Field(description="Normalized field identifier")
    value: Optional[Any] = Field(
        default=None,
        description="Extracted field value (number, string, list, etc.) or None if not found",
    )
    currency: Optional[str] = Field(
        default=None,
        description="Currency code if the field is a monetary amount (e.g. INR)",
    )
    status: FieldExtractionStatus = Field(
        description="Extraction status (EXTRACTED, NOT_FOUND, NEEDS_REVIEW)",
    )
    source_page: Optional[int] = Field(
        default=None,
        description="1-based source page number where the field was found",
    )
    evidence_snippet: Optional[str] = Field(
        default=None,
        description="Short exact or near-exact quote from the document supporting this value",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Estimated confidence score (0.0 to 1.0); not a correctness guarantee",
    )


class EligibilityRule(BaseModel):
    """Structured eligibility rule extracted from a scholarship notice."""

    field: str = Field(description="Target criteria field name (e.g. annual_income, marks)")
    operator: RuleOperator = Field(description="Strict comparison operator")
    expected_value: Any = Field(description="Expected threshold or allowed list of values")
    unit: Optional[str] = Field(default=None, description="Unit if applicable (e.g. INR, %, CGPA)")
    source_page: Optional[int] = Field(
        default=None,
        description="1-based page number where the rule was identified",
    )
    evidence_snippet: Optional[str] = Field(
        default=None,
        description="Short quote from the document stating this rule",
    )
    status: FieldExtractionStatus = Field(
        default=FieldExtractionStatus.EXTRACTED,
        description="Status of rule extraction",
    )


class ExtractionResponse(BaseModel):
    """Unified API response for document extraction."""

    request_id: str = Field(description="Unique tracking ID for this extraction request")
    document_type: DocumentType = Field(description="Document type requested")
    processing_status: ProcessingStatus = Field(
        description="Overall processing status (COMPLETED, NEEDS_REVIEW, FAILED)",
    )
    page_count: int = Field(ge=0, description="Total number of pages processed")
    extracted_fields: List[ExtractedField] = Field(
        default_factory=list,
        description="List of structured fields extracted",
    )
    eligibility_rules: Optional[List[EligibilityRule]] = Field(
        default=None,
        description="List of extracted rules (populated for scholarship notices)",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Non-fatal warnings or review prompts (e.g. ambiguous dates, missing fields)",
    )
    provider_used: str = Field(description="Name of the extraction provider used (e.g. local, gemini)")
    schema_version: str = Field(default="1.0.0", description="Schema version of this response")


class ErrorResponse(BaseModel):
    """Standardized error response body."""

    error_code: str = Field(description="Stable programmatic error code")
    message: str = Field(description="Human-readable safe error message")
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional non-sensitive context or field validation details",
    )
