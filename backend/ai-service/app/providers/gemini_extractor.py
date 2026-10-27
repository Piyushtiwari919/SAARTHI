"""Google Gemini extraction provider using the official google-genai SDK."""

import asyncio
import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from app.core.config import Settings
from app.providers.base import BaseExtractionProvider, ProviderExtractionResult
from app.schemas.extraction import (
    DocumentType,
    EligibilityRule,
    ExtractedField,
    FieldExtractionStatus,
    RuleOperator,
)
from app.services.document_loader import PageContent
from app.utils.file_validation import DocumentServiceException

logger = logging.getLogger(__name__)


# Pydantic schemas specifically for Gemini structured output parsing
class GeminiExtractedField(BaseModel):
    field: str
    value: Optional[str | int | float | list] = None
    currency: Optional[str] = None
    status: FieldExtractionStatus
    source_page: Optional[int] = None
    evidence_snippet: Optional[str] = None
    confidence: Optional[float] = None


class GeminiEligibilityRule(BaseModel):
    field: str
    operator: RuleOperator
    expected_value: str | int | float | list
    unit: Optional[str] = None
    source_page: Optional[int] = None
    evidence_snippet: Optional[str] = None
    status: FieldExtractionStatus = FieldExtractionStatus.EXTRACTED


class GeminiExtractionOutput(BaseModel):
    extracted_fields: List[GeminiExtractedField] = Field(default_factory=list)
    eligibility_rules: Optional[List[GeminiEligibilityRule]] = None
    warnings: List[str] = Field(default_factory=list)


class GeminiExtractionProvider(BaseExtractionProvider):
    """
    Structured extraction provider powered by Google Gemini via google-genai.
    Respects strict privacy defaults: never logs prompts or documents, enforces timeouts,
    and validates outputs through Pydantic without silent mock fallbacks.
    """

    def __init__(self, settings: Settings, client=None):
        self.settings = settings
        self._client = client

    def _get_client(self):
        if self._client is not None:
            return self._client
        if not self.settings.is_gemini_configured():
            raise DocumentServiceException(
                error_code="EXTRACTION_FAILED",
                message="Gemini provider is requested but GEMINI_API_KEY is not configured.",
                status_code=500,
            )
        try:
            from google import genai
            self._client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
            return self._client
        except Exception as exc:
            logger.error("Failed to initialize Google GenAI client: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="EXTRACTION_FAILED",
                message="Failed to initialize AI model client",
                status_code=500,
            ) from exc

    async def extract(
        self,
        document_type: DocumentType,
        pages: List[PageContent],
    ) -> ProviderExtractionResult:
        client = self._get_client()

        # Build clean prompt instructions without logging content
        prompt = self._build_prompt(document_type, pages)

        try:
            # Enforce strict provider timeout
            raw_response = await asyncio.wait_for(
                asyncio.to_thread(self._call_gemini, client, prompt),
                timeout=self.settings.PROVIDER_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as te:
            logger.error("AI provider timed out after %.1f seconds", self.settings.PROVIDER_TIMEOUT_SECONDS)
            raise DocumentServiceException(
                error_code="PROVIDER_TIMEOUT",
                message=f"AI provider request timed out after {self.settings.PROVIDER_TIMEOUT_SECONDS}s",
                status_code=504,
            ) from te
        except DocumentServiceException:
            raise
        except Exception as exc:
            logger.error("AI provider error during extraction: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="EXTRACTION_FAILED",
                message="AI provider extraction call failed",
                status_code=502,
            ) from exc

        # Parse and validate response
        return self._parse_gemini_response(raw_response)

    def _call_gemini(self, client, prompt: str) -> str:
        """Synchronous call dispatched in thread pool."""
        response = client.models.generate_content(
            model=self.settings.GEMINI_MODEL,
            contents=prompt,
        )
        if not response or not response.text:
            raise DocumentServiceException(
                error_code="INVALID_EXTRACTION_OUTPUT",
                message="AI provider returned an empty response",
                status_code=502,
            )
        return response.text

    def _build_prompt(self, document_type: DocumentType, pages: List[PageContent]) -> str:
        # Build text pages representation with explicit page markers
        pages_text_blocks = []
        for p in pages:
            pages_text_blocks.append(f"--- PAGE {p.page_number} ---\n{p.text}")
        doc_text = "\n\n".join(pages_text_blocks)

        system_instructions = (
            "You are a specialized document information extractor for Saarthi. "
            "You must extract structured information strictly according to the specified document type.\n"
            "Rules:\n"
            "1. Output valid JSON matching the schema below. Do not wrap in markdown or explanation.\n"
            "2. Never fabricate values. If a field is not explicitly present, use status: 'NOT_FOUND' and value: null.\n"
            "3. If a value is ambiguous (such as ambiguous dates like 05/06/2023), set status: 'NEEDS_REVIEW'.\n"
            "4. For each extracted item, specify source_page (integer) and an exact evidence_snippet from the text.\n"
            "5. For eligibility rules, operators must strictly be one of: 'EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN'.\n"
        )

        if document_type == DocumentType.INCOME_CERTIFICATE:
            schema_hint = (
                "Document Type: INCOME_CERTIFICATE.\n"
                "Extract fields:\n"
                "- annual_family_income (integer)\n"
                "- currency (string, e.g. 'INR')\n"
                "- issue_date (string, normalized to YYYY-MM-DD if unambiguous)\n"
                "- issuer (string)\n"
                "- certificate_number (string)\n"
            )
        else:
            schema_hint = (
                "Document Type: SCHOLARSHIP_NOTICE.\n"
                "Extract fields:\n"
                "- opportunity_title (string)\n"
                "- issuer (string)\n"
                "- application_deadline (string, normalized to YYYY-MM-DD if unambiguous)\n"
                "- required_documents (list of strings)\n"
                "And eligibility_rules (list of objects with field, operator, expected_value, unit, source_page, evidence_snippet).\n"
            )

        return (
            f"{system_instructions}\n"
            f"{schema_hint}\n"
            f"Expected JSON Schema structure:\n"
            "{\n"
            '  "extracted_fields": [\n'
            '    {"field": "...", "value": ..., "currency": null, "status": "EXTRACTED|NOT_FOUND|NEEDS_REVIEW", "source_page": 1, "evidence_snippet": "...", "confidence": 0.9}\n'
            "  ],\n"
            '  "eligibility_rules": [\n'
            '    {"field": "...", "operator": "LTE|GTE|EQ|...", "expected_value": ..., "unit": "...", "source_page": 1, "evidence_snippet": "...", "status": "EXTRACTED"}\n'
            "  ],\n"
            '  "warnings": ["..."]\n'
            "}\n\n"
            f"Document Text:\n{doc_text}\n"
        )

    def _parse_gemini_response(self, text: str) -> ProviderExtractionResult:
        cleaned = text.strip()
        # Remove potential markdown fences
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error("AI provider output is not valid JSON")
            raise DocumentServiceException(
                error_code="INVALID_EXTRACTION_OUTPUT",
                message="AI provider output is not valid JSON",
                status_code=502,
            ) from exc

        try:
            validated = GeminiExtractionOutput.model_validate(data)
        except Exception as exc:
            logger.error("AI provider output failed schema validation: %s", type(exc).__name__)
            raise DocumentServiceException(
                error_code="INVALID_EXTRACTION_OUTPUT",
                message="AI provider output does not match expected extraction schema",
                status_code=502,
            ) from exc

        # Convert to domain models
        domain_fields = [
            ExtractedField(
                field=f.field,
                value=f.value,
                currency=f.currency,
                status=f.status,
                source_page=f.source_page,
                evidence_snippet=f.evidence_snippet,
                confidence=f.confidence,
            )
            for f in validated.extracted_fields
        ]

        domain_rules = None
        if validated.eligibility_rules is not None:
            domain_rules = [
                EligibilityRule(
                    field=r.field,
                    operator=r.operator,
                    expected_value=r.expected_value,
                    unit=r.unit,
                    source_page=r.source_page,
                    evidence_snippet=r.evidence_snippet,
                    status=r.status,
                )
                for r in validated.eligibility_rules
            ]

        return ProviderExtractionResult(
            extracted_fields=domain_fields,
            eligibility_rules=domain_rules,
            warnings=validated.warnings,
            provider_used=f"gemini ({self.settings.GEMINI_MODEL})",
        )

