"""Integration tests for the internal document extraction API route."""

import logging
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.providers.gemini_extractor import GeminiExtractionProvider
from app.services.document_loader import DocumentLoaderService
from app.services.extraction_service import ExtractionService
from app.services.ocr_service import OCRService
from tests.conftest import TEST_INTERNAL_TOKEN, make_test_settings


def test_missing_auth_token_rejected(client: TestClient, synthetic_income_pdf: bytes):
    response = client.post(
        "/internal/v1/documents/extract",
        files={"file": ("income.pdf", synthetic_income_pdf, "application/pdf")},
        data={"document_type": "INCOME_CERTIFICATE"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error_code"] == "UNAUTHORIZED_INTERNAL_CALL"


def test_incorrect_auth_token_rejected(client: TestClient, synthetic_income_pdf: bytes):
    response = client.post(
        "/internal/v1/documents/extract",
        headers={"X-Internal-Service-Token": "wrong-secret-token"},
        files={"file": ("income.pdf", synthetic_income_pdf, "application/pdf")},
        data={"document_type": "INCOME_CERTIFICATE"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error_code"] == "UNAUTHORIZED_INTERNAL_CALL"


def test_successful_income_extraction_api(
    client: TestClient,
    valid_auth_headers: dict,
    synthetic_income_pdf: bytes,
):
    response = client.post(
        "/internal/v1/documents/extract",
        headers=valid_auth_headers,
        files={"file": ("income.pdf", synthetic_income_pdf, "application/pdf")},
        data={"document_type": "INCOME_CERTIFICATE"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["document_type"] == "INCOME_CERTIFICATE"
    assert data["processing_status"] == "COMPLETED"
    assert data["page_count"] == 1
    assert data["provider_used"] == "local"
    assert "request_id" in data

    field_map = {f["field"]: f for f in data["extracted_fields"]}
    assert field_map["annual_family_income"]["value"] == 180000
    assert field_map["annual_family_income"]["currency"] == "INR"
    assert field_map["annual_family_income"]["source_page"] == 1
    assert "1,80,000" in field_map["annual_family_income"]["evidence_snippet"]

    assert field_map["issue_date"]["value"] == "2024-08-25"
    assert field_map["issue_date"]["status"] == "EXTRACTED"

    assert "tahsildar" in field_map["issuer"]["value"].lower()
    assert field_map["certificate_number"]["value"] == "INC/2024/78219"


def test_ambiguous_date_marks_status_needs_review(
    client: TestClient,
    valid_auth_headers: dict,
    synthetic_ambiguous_date_pdf: bytes,
):
    response = client.post(
        "/internal/v1/documents/extract",
        headers=valid_auth_headers,
        files={"file": ("ambiguous.pdf", synthetic_ambiguous_date_pdf, "application/pdf")},
        data={"document_type": "INCOME_CERTIFICATE"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["processing_status"] == "NEEDS_REVIEW"
    field_map = {f["field"]: f for f in data["extracted_fields"]}
    assert field_map["issue_date"]["status"] == "NEEDS_REVIEW"
    assert any("Ambiguous date" in w for w in data["warnings"])


def test_successful_scholarship_notice_api(
    client: TestClient,
    valid_auth_headers: dict,
    synthetic_scholarship_pdf: bytes,
):
    response = client.post(
        "/internal/v1/documents/extract",
        headers=valid_auth_headers,
        files={"file": ("notice.pdf", synthetic_scholarship_pdf, "application/pdf")},
        data={"document_type": "SCHOLARSHIP_NOTICE"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["document_type"] == "SCHOLARSHIP_NOTICE"
    assert data["page_count"] == 2

    # Check extracted fields
    field_map = {f["field"]: f for f in data["extracted_fields"]}
    assert "NATIONAL MERIT SCHOLARSHIP" in field_map["opportunity_title"]["value"]
    assert "MINISTRY OF EDUCATION" in field_map["issuer"]["value"]
    assert field_map["application_deadline"]["value"] == "2024-10-31"

    # Check eligibility rules
    assert data["eligibility_rules"] is not None
    assert len(data["eligibility_rules"]) == 2
    rule_map = {r["field"]: r for r in data["eligibility_rules"]}

    income_rule = rule_map["annual_income"]
    assert income_rule["operator"] == "LTE"
    assert income_rule["expected_value"] == 250000
    assert income_rule["source_page"] == 2

    marks_rule = rule_map["minimum_percentage"]
    assert marks_rule["operator"] == "GTE"
    assert marks_rule["expected_value"] == 60.0
    assert marks_rule["unit"] == "%"


def test_mocked_gemini_invalid_output_returns_502(
    valid_auth_headers: dict,
    synthetic_income_pdf: bytes,
):
    """Test when Gemini provider returns malformed / non-schema JSON output."""
    settings = make_test_settings(AI_PROVIDER="gemini", GEMINI_API_KEY="dummy_key")

    mock_client = MagicMock()
    # Mock model response returning broken output
    mock_response = MagicMock()
    mock_response.text = '{"extracted_fields": "not-a-list"}'
    mock_client.models.generate_content.return_value = mock_response

    gemini_provider = GeminiExtractionProvider(settings, client=mock_client)
    ocr_service = OCRService(settings)
    loader = DocumentLoaderService(settings, ocr_service)
    custom_service = ExtractionService(settings, loader, provider=gemini_provider)

    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    from app.api.routes.extraction import get_extraction_service
    app.dependency_overrides[get_extraction_service] = lambda: custom_service

    with TestClient(app) as test_client:
        response = test_client.post(
            "/internal/v1/documents/extract",
            headers=valid_auth_headers,
            files={"file": ("income.pdf", synthetic_income_pdf, "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert response.status_code == 502
        data = response.json()
        assert data["error_code"] == "INVALID_EXTRACTION_OUTPUT"


def test_mocked_gemini_timeout_returns_504(
    valid_auth_headers: dict,
    synthetic_income_pdf: bytes,
):
    """Test when Gemini provider times out."""
    settings = make_test_settings(
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="dummy_key",
        PROVIDER_TIMEOUT_SECONDS=0.01,  # extremely short timeout
    )

    import time
    mock_client = MagicMock()

    def slow_call(*args, **kwargs):
        time.sleep(0.1)
        return MagicMock(text="{}")

    mock_client.models.generate_content.side_effect = slow_call

    gemini_provider = GeminiExtractionProvider(settings, client=mock_client)
    ocr_service = OCRService(settings)
    loader = DocumentLoaderService(settings, ocr_service)
    custom_service = ExtractionService(settings, loader, provider=gemini_provider)

    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    from app.api.routes.extraction import get_extraction_service
    app.dependency_overrides[get_extraction_service] = lambda: custom_service

    with TestClient(app) as test_client:
        response = test_client.post(
            "/internal/v1/documents/extract",
            headers=valid_auth_headers,
            files={"file": ("income.pdf", synthetic_income_pdf, "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert response.status_code == 504
        data = response.json()
        assert data["error_code"] == "PROVIDER_TIMEOUT"


def test_sensitive_document_text_and_secrets_not_logged(
    client: TestClient,
    valid_auth_headers: dict,
    synthetic_income_pdf: bytes,
    caplog: pytest.LogCaptureFixture,
):
    """Verify that document text and secret tokens are never emitted into application logs."""
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/internal/v1/documents/extract",
            headers=valid_auth_headers,
            files={"file": ("income.pdf", synthetic_income_pdf, "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert response.status_code == 200

        # Check logs
        all_logs = " ".join(record.message for record in caplog.records)
        # Ensure secret token is not in logs
        assert TEST_INTERNAL_TOKEN not in all_logs
        # Ensure applicant's name / sensitive document payload is not in logs
        assert "Rahul Kumar" not in all_logs
