"""Deterministic local extraction provider using structured pattern matching."""

import re
from datetime import datetime
from typing import List, Optional, Tuple

from app.providers.base import BaseExtractionProvider, ProviderExtractionResult
from app.schemas.extraction import (
    DocumentType,
    EligibilityRule,
    ExtractedField,
    FieldExtractionStatus,
    RuleOperator,
)
from app.services.document_loader import PageContent


class LocalExtractionProvider(BaseExtractionProvider):
    """
    Deterministic rule- and regex-based extraction provider.
    Provides reliable, fast baseline extraction without external network dependencies.
    """

    async def extract(
        self,
        document_type: DocumentType,
        pages: List[PageContent],
    ) -> ProviderExtractionResult:
        if document_type == DocumentType.INCOME_CERTIFICATE:
            return self._extract_income_certificate(pages)
        elif document_type == DocumentType.SCHOLARSHIP_NOTICE:
            return self._extract_scholarship_notice(pages)
        else:
            raise ValueError(f"Unsupported document type: {document_type}")

    # -------------------------------------------------------------------------
    # INCOME_CERTIFICATE
    # -------------------------------------------------------------------------

    def _extract_income_certificate(
        self,
        pages: List[PageContent],
    ) -> ProviderExtractionResult:
        warnings: List[str] = []
        fields: List[ExtractedField] = []

        # 1. annual_family_income
        income_field = self._extract_income_amount(pages)
        if income_field:
            fields.append(income_field)
            # Add currency field companion
            fields.append(
                ExtractedField(
                    field="currency",
                    value="INR",
                    currency=None,
                    status=FieldExtractionStatus.EXTRACTED,
                    source_page=income_field.source_page,
                    evidence_snippet=income_field.evidence_snippet,
                    confidence=0.95,
                )
            )
        else:
            fields.append(
                ExtractedField(
                    field="annual_family_income",
                    value=None,
                    currency=None,
                    status=FieldExtractionStatus.NOT_FOUND,
                    source_page=None,
                    evidence_snippet=None,
                    confidence=0.0,
                )
            )
            fields.append(
                ExtractedField(
                    field="currency",
                    value=None,
                    status=FieldExtractionStatus.NOT_FOUND,
                )
            )
            warnings.append("Annual family income could not be identified in the document.")

        # 2. issue_date
        date_field, date_warn = self._extract_issue_date(pages)
        fields.append(date_field)
        if date_warn:
            warnings.append(date_warn)

        # 3. issuer
        issuer_field = self._extract_issuer(pages)
        fields.append(issuer_field)
        if issuer_field.status == FieldExtractionStatus.NOT_FOUND:
            warnings.append("Certificate issuing authority could not be determined.")

        # 4. certificate_number
        cert_num_field = self._extract_certificate_number(pages)
        fields.append(cert_num_field)

        return ProviderExtractionResult(
            extracted_fields=fields,
            eligibility_rules=None,
            warnings=warnings,
            provider_used="local",
        )

    def _extract_income_amount(self, pages: List[PageContent]) -> Optional[ExtractedField]:
        patterns = [
            # E.g., "Annual family income: Rs. 1,80,000" or "Total Annual Income: Rs 2,50,000/-"
            r"(?i)(?:annual(?:\s+family)?\s+income|family\s+income|gross\s+annual\s+income|total\s+income)\s*(?:is|of|:|-)?\s*(?:(?:Rs\.?|INR|₹)\s*)?([\d,]{4,12})",
            # E.g., "Rs. 1,80,000/- per annum"
            r"(?i)(?:(?:Rs\.?|INR|₹)\s*)([\d,]{4,12})(?:\s*/-)?\s*(?:per\s+annum|annual(?:ly)?|p\.a\.)",
            # E.g., "income is assessed at Rs. 200000"
            r"(?i)income\s+(?:is|of|at)\s+(?:Rs\.?|INR|₹)?\s*([\d,]{4,12})",
        ]

        for page in pages:
            for pattern in patterns:
                match = re.search(pattern, page.text)
                if match:
                    raw_num = match.group(1).replace(",", "").strip()
                    try:
                        numeric_val = int(raw_num)
                        snippet = self._make_snippet(page.text, match.start(), match.end())
                        return ExtractedField(
                            field="annual_family_income",
                            value=numeric_val,
                            currency="INR",
                            status=FieldExtractionStatus.EXTRACTED,
                            source_page=page.page_number,
                            evidence_snippet=snippet,
                            confidence=0.92,
                        )
                    except ValueError:
                        continue
        return None

    def _extract_issue_date(self, pages: List[PageContent]) -> Tuple[ExtractedField, Optional[str]]:
        date_patterns = [
            # Date of Issue: DD/MM/YYYY or YYYY-MM-DD
            r"(?i)(?:date\s+of\s+issue|issued\s+on|date\s*:|dated)\s*[:\s]*(\d{1,4}[-/.][A-Za-z0-9]+[-/.]\d{2,4})",
            # Named month: 15 August 2023 or August 15, 2023
            r"(?i)\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))[,\s]+\d{4})\b",
            # General standalone date
            r"\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b",
        ]

        for page in pages:
            for pattern in date_patterns:
                match = re.search(pattern, page.text)
                if match:
                    raw_date = match.group(1).strip()
                    normalized, status, warn = self._normalize_date(raw_date)
                    snippet = self._make_snippet(page.text, match.start(), match.end())
                    return (
                        ExtractedField(
                            field="issue_date",
                            value=normalized,
                            currency=None,
                            status=status,
                            source_page=page.page_number,
                            evidence_snippet=snippet,
                            confidence=0.90 if status == FieldExtractionStatus.EXTRACTED else 0.60,
                        ),
                        warn,
                    )

        return (
            ExtractedField(
                field="issue_date",
                value=None,
                currency=None,
                status=FieldExtractionStatus.NOT_FOUND,
                source_page=None,
                evidence_snippet=None,
                confidence=0.0,
            ),
            None,
        )

    def _extract_issuer(self, pages: List[PageContent]) -> ExtractedField:
        # Priority 1: Search for specific issuing office or authority
        for page in pages:
            for line in page.text.splitlines():
                clean_line = line.strip()
                if not clean_line:
                    continue

                # Pattern 1: Office of the Tahsildar / SDM / Collector
                match1 = re.search(
                    r"(?i)\b(Office of the [A-Za-z\s,]{1,40}?(?:Tahsildar|Magistrate|Collector|Revenue\s+Officer))\b",
                    clean_line,
                )
                if match1:
                    issuer_text = match1.group(1).strip()
                    return ExtractedField(
                        field="issuer",
                        value=issuer_text,
                        currency=None,
                        status=FieldExtractionStatus.EXTRACTED,
                        source_page=page.page_number,
                        evidence_snippet=clean_line[:120],
                        confidence=0.90,
                    )

                # Pattern 2: Specific authority keywords
                match2 = re.search(
                    r"(?i)\b(Tahsildar|Sub-Divisional\s+Magistrate|Revenue\s+Department|District\s+Collector|Deputy\s+Commissioner)\b",
                    clean_line,
                )
                if match2:
                    return ExtractedField(
                        field="issuer",
                        value=clean_line,
                        currency=None,
                        status=FieldExtractionStatus.EXTRACTED,
                        source_page=page.page_number,
                        evidence_snippet=clean_line[:120],
                        confidence=0.88,
                    )

        # Fallback Priority 2: Broad Government of <State> header
        for page in pages:
            for line in page.text.splitlines():
                clean_line = line.strip()
                match3 = re.search(
                    r"(?i)\b(Government of [A-Za-z\s]{2,30})\b",
                    clean_line,
                )
                if match3:
                    return ExtractedField(
                        field="issuer",
                        value=match3.group(1).strip(),
                        currency=None,
                        status=FieldExtractionStatus.EXTRACTED,
                        source_page=page.page_number,
                        evidence_snippet=clean_line[:120],
                        confidence=0.85,
                    )

        return ExtractedField(
            field="issuer",
            value=None,
            currency=None,
            status=FieldExtractionStatus.NOT_FOUND,
            source_page=None,
            evidence_snippet=None,
            confidence=0.0,
        )

    def _extract_certificate_number(self, pages: List[PageContent]) -> ExtractedField:
        patterns = [
            r"(?i)(?:certificate\s+no\.?|cert\s+no\.?|application\s+no\.?|case\s+no\.?|reference\s+no\.?)\s*[:#-]?\s*([A-Za-z0-9\/-]{5,30})",
            r"(?i)\b(INC/[0-9]{4}/[0-9]{4,10})\b",
        ]

        for page in pages:
            for pattern in patterns:
                match = re.search(pattern, page.text)
                if match:
                    cert_no = match.group(1).strip()
                    snippet = self._make_snippet(page.text, match.start(), match.end())
                    return ExtractedField(
                        field="certificate_number",
                        value=cert_no,
                        currency=None,
                        status=FieldExtractionStatus.EXTRACTED,
                        source_page=page.page_number,
                        evidence_snippet=snippet,
                        confidence=0.94,
                    )

        return ExtractedField(
            field="certificate_number",
            value=None,
            currency=None,
            status=FieldExtractionStatus.NOT_FOUND,
            source_page=None,
            evidence_snippet=None,
            confidence=0.0,
        )

    # -------------------------------------------------------------------------
    # SCHOLARSHIP_NOTICE
    # -------------------------------------------------------------------------

    def _extract_scholarship_notice(
        self,
        pages: List[PageContent],
    ) -> ProviderExtractionResult:
        warnings: List[str] = []
        fields: List[ExtractedField] = []
        rules: List[EligibilityRule] = []

        # 1. opportunity_title
        title_field = self._extract_opportunity_title(pages)
        fields.append(title_field)
        if title_field.status == FieldExtractionStatus.NOT_FOUND:
            warnings.append("Scholarship title could not be determined.")

        # 2. issuer
        issuer_field = self._extract_scholarship_issuer(pages)
        fields.append(issuer_field)

        # 3. application_deadline
        deadline_field, deadline_warn = self._extract_deadline(pages)
        fields.append(deadline_field)
        if deadline_warn:
            warnings.append(deadline_warn)

        # 4. required_documents
        req_docs_field = self._extract_required_documents(pages)
        fields.append(req_docs_field)

        # 5. eligibility_rules
        extracted_rules, rule_warnings = self._extract_eligibility_rules(pages)
        rules.extend(extracted_rules)
        warnings.extend(rule_warnings)

        return ProviderExtractionResult(
            extracted_fields=fields,
            eligibility_rules=rules,
            warnings=warnings,
            provider_used="local",
        )

    def _extract_opportunity_title(self, pages: List[PageContent]) -> ExtractedField:
        if pages:
            lines = [l.strip() for l in pages[0].text.splitlines() if l.strip()]
            for line in lines[:5]:
                if re.search(r"(?i)\b(?:Scholarship|Fellowship|Award|Scheme|Grant)\b", line):
                    return ExtractedField(
                        field="opportunity_title",
                        value=line[:100].strip(),
                        currency=None,
                        status=FieldExtractionStatus.EXTRACTED,
                        source_page=1,
                        evidence_snippet=line[:120],
                        confidence=0.92,
                    )

        return ExtractedField(
            field="opportunity_title",
            value=None,
            currency=None,
            status=FieldExtractionStatus.NOT_FOUND,
            source_page=None,
            evidence_snippet=None,
            confidence=0.0,
        )

    def _extract_scholarship_issuer(self, pages: List[PageContent]) -> ExtractedField:
        for page in pages:
            for line in page.text.splitlines():
                clean_line = line.strip()
                if not clean_line:
                    continue

                match = re.search(
                    r"(?i)\b(Ministry of [A-Za-z\s,]{2,40}|Department of [A-Za-z\s,]{2,40}|[A-Za-z\s]{2,40} (?:Foundation|Trust|Board))\b",
                    clean_line,
                )
                if match:
                    return ExtractedField(
                        field="issuer",
                        value=match.group(1).strip(),
                        currency=None,
                        status=FieldExtractionStatus.EXTRACTED,
                        source_page=page.page_number,
                        evidence_snippet=clean_line[:120],
                        confidence=0.88,
                    )

        return ExtractedField(
            field="issuer",
            value=None,
            currency=None,
            status=FieldExtractionStatus.NOT_FOUND,
            source_page=None,
            evidence_snippet=None,
            confidence=0.0,
        )

    def _extract_deadline(self, pages: List[PageContent]) -> Tuple[ExtractedField, Optional[str]]:
        deadline_patterns = [
            r"(?i)(?:last\s+date\s+(?:for|to|of)?\s*(?:submission|application|apply)?|application\s+deadline|deadline)\s*[:\s]*(\d{1,4}[-/.][A-Za-z0-9]+[-/.]\d{2,4})",
            r"(?i)(?:last\s+date\s+(?:for|to|of)?\s*(?:submission|application|apply)?|application\s+deadline|deadline)\s*[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))[,\s]+\d{4})",
        ]

        for page in pages:
            for pattern in deadline_patterns:
                match = re.search(pattern, page.text)
                if match:
                    raw_date = match.group(1).strip()
                    normalized, status, warn = self._normalize_date(raw_date)
                    snippet = self._make_snippet(page.text, match.start(), match.end())
                    return (
                        ExtractedField(
                            field="application_deadline",
                            value=normalized,
                            currency=None,
                            status=status,
                            source_page=page.page_number,
                            evidence_snippet=snippet,
                            confidence=0.92 if status == FieldExtractionStatus.EXTRACTED else 0.60,
                        ),
                        warn,
                    )

        return (
            ExtractedField(
                field="application_deadline",
                value=None,
                currency=None,
                status=FieldExtractionStatus.NOT_FOUND,
                source_page=None,
                evidence_snippet=None,
                confidence=0.0,
            ),
            None,
        )

    def _extract_required_documents(self, pages: List[PageContent]) -> ExtractedField:
        known_docs = [
            ("Income Certificate", r"(?i)\bincome\s+certificate\b"),
            ("Marksheet", r"(?i)\b(?:marksheet|mark\s+sheet|grade\s+card)\b"),
            ("Bonafide Certificate", r"(?i)\bbonafide\s+certificate\b"),
            ("Domicile Certificate", r"(?i)\bdomicile\s+certificate\b"),
            ("Caste Certificate", r"(?i)\bcaste\s+certificate\b"),
            ("Aadhaar Card", r"(?i)\b(?:aadhaar|aadhar)\s*(?:card)?\b"),
            ("Bank Passbook", r"(?i)\bbank\s+(?:passbook|account\s+details)\b"),
            ("Fee Receipt", r"(?i)\bfee\s+receipt\b"),
            ("Admission Letter", r"(?i)\badmission\s+letter\b"),
        ]

        found_docs: List[str] = []
        first_snippet: Optional[str] = None
        first_page: Optional[int] = None

        for page in pages:
            for doc_name, pattern in known_docs:
                if doc_name not in found_docs:
                    match = re.search(pattern, page.text)
                    if match:
                        found_docs.append(doc_name)
                        if first_snippet is None:
                            first_snippet = self._make_snippet(page.text, match.start(), match.end())
                            first_page = page.page_number

        if found_docs:
            return ExtractedField(
                field="required_documents",
                value=found_docs,
                currency=None,
                status=FieldExtractionStatus.EXTRACTED,
                source_page=first_page,
                evidence_snippet=first_snippet,
                confidence=0.90,
            )

        return ExtractedField(
            field="required_documents",
            value=[],
            currency=None,
            status=FieldExtractionStatus.NOT_FOUND,
            source_page=None,
            evidence_snippet=None,
            confidence=0.0,
        )

    def _extract_eligibility_rules(
        self,
        pages: List[PageContent],
    ) -> Tuple[List[EligibilityRule], List[str]]:
        rules: List[EligibilityRule] = []
        warnings: List[str] = []

        # 1. Income rule (e.g. "Annual family income must not exceed Rs. 2,50,000")
        income_rule_patterns = [
            (
                r"(?i)(?:family\s+)?income\s+(?:must\s+not\s+exceed|should\s+be\s+less\s+than|up\s+to|not\s+more\s+than|less\s+than\s+or\s+equal\s+to|<=|not\s+exceeding)\s*(?:(?:Rs\.?|INR|₹)\s*)?([\d,]{4,12})",
                RuleOperator.LTE,
            ),
            (
                r"(?i)(?:family\s+)?income\s+(?:is\s+greater\s+than|more\s+than|>)\s*(?:(?:Rs\.?|INR|₹)\s*)?([\d,]{4,12})",
                RuleOperator.GT,
            ),
        ]

        for page in pages:
            for pattern, operator in income_rule_patterns:
                match = re.search(pattern, page.text)
                if match:
                    raw_num = match.group(1).replace(",", "").strip()
                    try:
                        numeric_val = int(raw_num)
                        snippet = self._make_snippet(page.text, match.start(), match.end())
                        rules.append(
                            EligibilityRule(
                                field="annual_income",
                                operator=operator,
                                expected_value=numeric_val,
                                unit="INR",
                                source_page=page.page_number,
                                evidence_snippet=snippet,
                                status=FieldExtractionStatus.EXTRACTED,
                            )
                        )
                        break
                    except ValueError:
                        continue

        # 2. Percentage / Marks rule (e.g. "Minimum 60% marks in previous examination")
        marks_patterns = [
            (
                r"(?i)(?:minimum|at\s+least|scoring\s+at\s+least|not\s+less\s+than|>=)\s*(\d{1,2}(?:\.\d+)?)\s*%\s*(?:marks)?",
                RuleOperator.GTE,
            ),
            (
                r"(?i)(\d{1,2}(?:\.\d+)?)\s*%\s*marks\s*(?:or\s+above|minimum)",
                RuleOperator.GTE,
            ),
        ]

        for page in pages:
            for pattern, operator in marks_patterns:
                match = re.search(pattern, page.text)
                if match:
                    raw_pct = match.group(1).strip()
                    try:
                        pct_val = float(raw_pct)
                        snippet = self._make_snippet(page.text, match.start(), match.end())
                        rules.append(
                            EligibilityRule(
                                field="minimum_percentage",
                                operator=operator,
                                expected_value=pct_val,
                                unit="%",
                                source_page=page.page_number,
                                evidence_snippet=snippet,
                                status=FieldExtractionStatus.EXTRACTED,
                            )
                        )
                        break
                    except ValueError:
                        continue

        return rules, warnings

    # -------------------------------------------------------------------------
    # DATE NORMALIZATION & HELPERS
    # -------------------------------------------------------------------------

    def _normalize_date(
        self,
        raw_date: str,
    ) -> Tuple[Optional[str], FieldExtractionStatus, Optional[str]]:
        raw_clean = raw_date.strip().rstrip(".,")

        # ISO format: 2024-10-31 or 2024/10/31
        iso_match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", raw_clean)
        if iso_match:
            year, month, day = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
            try:
                dt = datetime(year, month, day)
                return dt.strftime("%Y-%m-%d"), FieldExtractionStatus.EXTRACTED, None
            except ValueError:
                return raw_clean, FieldExtractionStatus.NEEDS_REVIEW, f"Invalid date: {raw_clean}"

        # Named month format: 15 August 2023, August 15, 2023, 15-Aug-2023
        for fmt in (
            "%d %B %Y",
            "%d %b %Y",
            "%B %d, %Y",
            "%b %d, %Y",
            "%B %d %Y",
            "%d-%b-%Y",
            "%d-%B-%Y",
        ):
            cleaned_named = re.sub(r"(\d+)(?:st|nd|rd|th)", r"\1", raw_clean)
            try:
                dt = datetime.strptime(cleaned_named, fmt)
                return dt.strftime("%Y-%m-%d"), FieldExtractionStatus.EXTRACTED, None
            except ValueError:
                continue

        # Numeric formats: A/B/YYYY or A-B-YYYY
        num_match = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$", raw_clean)
        if num_match:
            first, second, year = int(num_match.group(1)), int(num_match.group(2)), int(num_match.group(3))

            # If both <= 12 and not equal, day vs month is ambiguous!
            if first <= 12 and second <= 12 and first != second:
                warning = (
                    f"Ambiguous date format '{raw_clean}' (day and month both <= 12). Marked for manual review."
                )
                return raw_clean, FieldExtractionStatus.NEEDS_REVIEW, warning

            # If first > 12, it must be DD-MM-YYYY
            if first > 12 and second <= 12:
                try:
                    dt = datetime(year, second, first)
                    return dt.strftime("%Y-%m-%d"), FieldExtractionStatus.EXTRACTED, None
                except ValueError:
                    return raw_clean, FieldExtractionStatus.NEEDS_REVIEW, f"Invalid date values: {raw_clean}"

            # If second > 12, it must be MM-DD-YYYY
            if second > 12 and first <= 12:
                try:
                    dt = datetime(year, first, second)
                    return dt.strftime("%Y-%m-%d"), FieldExtractionStatus.EXTRACTED, None
                except ValueError:
                    return raw_clean, FieldExtractionStatus.NEEDS_REVIEW, f"Invalid date values: {raw_clean}"

            # If first == second (e.g. 05/05/2023), unambiguous
            if first == second and first <= 12:
                try:
                    dt = datetime(year, first, second)
                    return dt.strftime("%Y-%m-%d"), FieldExtractionStatus.EXTRACTED, None
                except ValueError:
                    pass

        return (
            raw_clean,
            FieldExtractionStatus.NEEDS_REVIEW,
            f"Unrecognized or ambiguous date format: '{raw_clean}'. Marked for manual review.",
        )

    @staticmethod
    def _make_snippet(text: str, start: int, end: int, window: int = 50) -> str:
        """Create a clean, bounded evidence snippet around the matched range."""
        snippet_start = max(0, start - window)
        snippet_end = min(len(text), end + window)
        snippet = text[snippet_start:snippet_end].replace("\n", " ").strip()
        snippet = re.sub(r"\s+", " ", snippet)
        return snippet[:150]
