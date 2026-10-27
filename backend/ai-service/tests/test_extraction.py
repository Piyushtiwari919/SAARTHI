"""Unit tests for structured extraction, date ambiguity, missing fields, and rules."""

import pytest

from app.providers.local_extractor import LocalExtractionProvider
from app.schemas.extraction import (
    DocumentType,
    FieldExtractionStatus,
    RuleOperator,
)
from app.services.document_loader import PageContent


@pytest.mark.asyncio
async def test_extract_income_certificate_success():
    provider = LocalExtractionProvider()
    pages = [
        PageContent(
            page_number=1,
            text=(
                "GOVERNMENT OF MAHARASHTRA\n"
                "OFFICE OF THE TAHSILDAR, HAVELI\n\n"
                "INCOME CERTIFICATE\n"
                "Certificate No: INC/2024/78219\n"
                "Date of Issue: 25/08/2024\n\n"
                "This is to certify that the Annual Family Income of\n"
                "Applicant Shri Rahul Kumar is assessed at Rs. 1,80,000/- per annum.\n"
            ),
            status="TEXT_EXTRACTED",
        )
    ]

    result = await provider.extract(DocumentType.INCOME_CERTIFICATE, pages)
    field_map = {f.field: f for f in result.extracted_fields}

    # annual_family_income
    assert "annual_family_income" in field_map
    income_f = field_map["annual_family_income"]
    assert income_f.status == FieldExtractionStatus.EXTRACTED
    assert income_f.value == 180000
    assert income_f.currency == "INR"
    assert income_f.source_page == 1
    assert "1,80,000" in income_f.evidence_snippet

    # currency
    assert field_map["currency"].value == "INR"

    # issue_date (unambiguous, day 25 > 12)
    date_f = field_map["issue_date"]
    assert date_f.status == FieldExtractionStatus.EXTRACTED
    assert date_f.value == "2024-08-25"
    assert date_f.source_page == 1

    # issuer
    issuer_f = field_map["issuer"]
    assert issuer_f.status == FieldExtractionStatus.EXTRACTED
    assert "tahsildar" in issuer_f.value.lower()
    assert issuer_f.source_page == 1

    # certificate_number
    cert_f = field_map["certificate_number"]
    assert cert_f.status == FieldExtractionStatus.EXTRACTED
    assert cert_f.value == "INC/2024/78219"
    assert cert_f.source_page == 1


@pytest.mark.asyncio
async def test_extract_income_certificate_missing_fields():
    provider = LocalExtractionProvider()
    # Document with only partial information
    pages = [
        PageContent(
            page_number=1,
            text="Sample certificate document with no income figures or certificate number.",
            status="TEXT_EXTRACTED",
        )
    ]

    result = await provider.extract(DocumentType.INCOME_CERTIFICATE, pages)
    field_map = {f.field: f for f in result.extracted_fields}

    # Missing income
    assert field_map["annual_family_income"].status == FieldExtractionStatus.NOT_FOUND
    assert field_map["annual_family_income"].value is None

    # Missing cert number
    assert field_map["certificate_number"].status == FieldExtractionStatus.NOT_FOUND
    assert field_map["certificate_number"].value is None

    # Missing issuer
    assert field_map["issuer"].status == FieldExtractionStatus.NOT_FOUND
    assert field_map["issuer"].value is None

    assert any("Annual family income could not be identified" in w for w in result.warnings)


@pytest.mark.asyncio
async def test_ambiguous_date_marked_needs_review():
    provider = LocalExtractionProvider()
    # 05/06/2024 is ambiguous (May 6 or June 5)
    pages = [
        PageContent(
            page_number=1,
            text=(
                "Government Revenue Authority\n"
                "Date of Issue: 05/06/2024\n"
                "Total Annual Income: Rs. 2,00,000\n"
                "Cert No: INC/2024/11223\n"
            ),
            status="TEXT_EXTRACTED",
        )
    ]

    result = await provider.extract(DocumentType.INCOME_CERTIFICATE, pages)
    field_map = {f.field: f for f in result.extracted_fields}

    date_f = field_map["issue_date"]
    assert date_f.status == FieldExtractionStatus.NEEDS_REVIEW
    assert date_f.value == "05/06/2024"
    assert any("Ambiguous date" in w for w in result.warnings)


@pytest.mark.asyncio
async def test_extract_scholarship_notice_and_rules():
    provider = LocalExtractionProvider()
    pages = [
        PageContent(
            page_number=1,
            text=(
                "NATIONAL MERIT SCHOLARSHIP SCHEME 2024-25\n"
                "MINISTRY OF EDUCATION\n\n"
                "Application Deadline: 31/10/2024\n"
                "Required Documents:\n"
                "- Income Certificate\n"
                "- Marksheet\n"
                "- Domicile Certificate\n"
            ),
            status="TEXT_EXTRACTED",
        ),
        PageContent(
            page_number=2,
            text=(
                "ELIGIBILITY GUIDELINES:\n"
                "1. Annual family income must not exceed Rs. 2,50,000/-.\n"
                "2. Candidate must secure minimum 60% marks in previous examination.\n"
            ),
            status="TEXT_EXTRACTED",
        ),
    ]

    result = await provider.extract(DocumentType.SCHOLARSHIP_NOTICE, pages)
    field_map = {f.field: f for f in result.extracted_fields}

    # opportunity_title
    assert "NATIONAL MERIT SCHOLARSHIP" in field_map["opportunity_title"].value
    assert field_map["opportunity_title"].status == FieldExtractionStatus.EXTRACTED
    assert field_map["opportunity_title"].source_page == 1

    # issuer
    assert "MINISTRY OF EDUCATION" in field_map["issuer"].value
    assert field_map["issuer"].status == FieldExtractionStatus.EXTRACTED

    # application_deadline (unambiguous, 31 > 12)
    assert field_map["application_deadline"].value == "2024-10-31"
    assert field_map["application_deadline"].status == FieldExtractionStatus.EXTRACTED

    # required_documents
    docs = field_map["required_documents"].value
    assert "Income Certificate" in docs
    assert "Marksheet" in docs
    assert "Domicile Certificate" in docs

    # eligibility_rules
    assert result.eligibility_rules is not None
    assert len(result.eligibility_rules) == 2

    income_rule = next(r for r in result.eligibility_rules if r.field == "annual_income")
    assert income_rule.operator == RuleOperator.LTE
    assert income_rule.expected_value == 250000
    assert income_rule.unit == "INR"
    assert income_rule.source_page == 2
    assert "2,50,000" in income_rule.evidence_snippet

    marks_rule = next(r for r in result.eligibility_rules if r.field == "minimum_percentage")
    assert marks_rule.operator == RuleOperator.GTE
    assert marks_rule.expected_value == 60.0
    assert marks_rule.unit == "%"
    assert marks_rule.source_page == 2
