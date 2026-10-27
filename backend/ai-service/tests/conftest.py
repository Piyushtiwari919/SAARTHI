"""Shared pytest fixtures, synthetic document generators, and test clients."""

import io
from typing import List
import pytest
from fastapi.testclient import TestClient
from PIL import Image
import pymupdf

from app.core.config import Settings, get_settings
from app.main import create_app


TEST_INTERNAL_TOKEN = "test_secret_internal_token_xyz"


def make_test_settings(**kwargs) -> Settings:
    """Create isolated settings for unit testing."""
    defaults = {
        "ENVIRONMENT": "test",
        "INTERNAL_SERVICE_TOKEN": TEST_INTERNAL_TOKEN,
        "AI_PROVIDER": "local",
        "MAX_UPLOAD_BYTES": 1024 * 1024,  # 1 MB for testing
        "MAX_PDF_PAGES": 5,
        "OCR_ENABLED": True,
        "PROVIDER_TIMEOUT_SECONDS": 2.0,
    }
    defaults.update(kwargs)
    return Settings(**defaults)


@pytest.fixture
def test_settings() -> Settings:
    return make_test_settings()


@pytest.fixture
def client(test_settings: Settings) -> TestClient:
    """FastAPI TestClient with overridden dependency settings."""
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: test_settings
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def valid_auth_headers() -> dict:
    return {"X-Internal-Service-Token": TEST_INTERNAL_TOKEN}


def create_synthetic_pdf(pages_text: List[str]) -> bytes:
    """
    Generate an in-memory synthetic PDF with the provided text on each page.
    Does not write to disk; preserves page boundaries cleanly.
    """
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page(width=595, height=842)  # A4 size in points
        # Insert text at top margin
        page.insert_text(
            pymupdf.Point(50, 72),
            text,
            fontsize=12,
            fontname="helv",
        )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_synthetic_image(format_name: str = "PNG") -> bytes:
    """Generate an in-memory synthetic image file (PNG or JPEG)."""
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()


@pytest.fixture
def synthetic_income_pdf() -> bytes:
    """Synthetic income certificate with unambiguous date and explicit fields."""
    content = (
        "GOVERNMENT OF MAHARASHTRA\n"
        "OFFICE OF THE TAHSILDAR, HAVELI\n\n"
        "INCOME CERTIFICATE\n"
        "Certificate No: INC/2024/78219\n"
        "Date of Issue: 25/08/2024\n\n"
        "This is to certify that after due inquiry, the Annual Family Income of\n"
        "Applicant Shri Rahul Kumar is assessed at Rs. 1,80,000/- per annum\n"
        "(Rupees One Lakh Eighty Thousand Only).\n\n"
        "Issuing Authority: Tahsildar, Haveli\n"
    )
    return create_synthetic_pdf([content])


@pytest.fixture
def synthetic_ambiguous_date_pdf() -> bytes:
    """Synthetic income certificate with an ambiguous date format (05/06/2024)."""
    content = (
        "GOVERNMENT OF KARNATAKA\n"
        "REVENUE DEPARTMENT\n\n"
        "INCOME CERTIFICATE\n"
        "Case No: REV-99214\n"
        "Dated: 05/06/2024\n\n"
        "Annual family income is Rs. 2,20,000.\n"
    )
    return create_synthetic_pdf([content])


@pytest.fixture
def synthetic_scholarship_pdf() -> bytes:
    """Synthetic multi-page scholarship notice with eligibility criteria."""
    page_1 = (
        "NATIONAL MERIT SCHOLARSHIP SCHEME 2024-25\n"
        "MINISTRY OF EDUCATION, GOVERNMENT OF INDIA\n\n"
        "PUBLIC NOTICE FOR APPLICATIONS\n"
        "Applications are invited from eligible students across India.\n"
        "Application Deadline: 31/10/2024\n\n"
        "Required Documents:\n"
        "1. Income Certificate\n"
        "2. Marksheet of previous examination\n"
        "3. Domicile Certificate\n"
        "4. Bank Passbook\n"
    )
    page_2 = (
        "ELIGIBILITY CRITERIA AND NORMS\n\n"
        "1. Annual family income must not exceed Rs. 2,50,000/- per annum.\n"
        "2. Candidates must secure minimum 60% marks in the qualifying examination.\n"
        "3. Applicant must hold a valid Bank Account Passbook in their own name.\n"
    )
    return create_synthetic_pdf([page_1, page_2])
