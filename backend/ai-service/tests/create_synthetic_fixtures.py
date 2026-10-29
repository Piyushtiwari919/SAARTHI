"""Generate synthetic PDF fixtures for end-to-end integration testing."""

import os
import pymupdf

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(FIXTURES_DIR, exist_ok=True)

def generate_fixtures():
    # 1. Synthetic Scholarship Notice (2 pages)
    notice_path = os.path.join(FIXTURES_DIR, "synthetic_scholarship_notice.pdf")
    doc_notice = pymupdf.open()
    
    # Page 1
    page1 = doc_notice.new_page(width=595, height=842)
    p1_text = (
        "SYNTHETIC TEST DOCUMENT — NOT AN OFFICIAL NOTICE\n\n"
        "NATIONAL MERIT SCHOLARSHIP SCHEME 2026\n"
        "MINISTRY OF EDUCATION, GOVERNMENT OF INDIA\n\n"
        "Official Guidelines and Circular\n"
        "Circular Reference: NMSS/2026/GEN-04\n"
        "Date of Announcement: 15/07/2026\n"
        "Application Deadline: 31/12/2026\n\n"
        "Required Documents for Application:\n"
        "1. Income Certificate (issued by competent revenue authority)\n"
        "2. Marksheet of qualifying degree/examination\n"
        "3. Domicile Certificate\n"
        "4. Bonafide Student Enrollment Certificate\n"
    )
    page1.insert_text((50, 60), p1_text, fontsize=12)

    # Page 2
    page2 = doc_notice.new_page(width=595, height=842)
    p2_text = (
        "SYNTHETIC TEST DOCUMENT — NOT AN OFFICIAL NOTICE\n\n"
        "ELIGIBILITY RULES & SELECTION NORMS\n\n"
        "Clause 1: Minimum Percentage Requirement\n"
        "Applicants must have secured a minimum of 60% marks or equivalent CGPA in the preceding qualifying examination.\n\n"
        "Clause 2: Family Income Ceiling\n"
        "The annual family income from all sources must not exceed Rs. 2,50,000/- per annum.\n\n"
        "Clause 3: Academic Level\n"
        "Open to undergraduate and postgraduate students enrolled in recognized regular full-time courses.\n\n"
        "Clause 4: Verification Authority\n"
        "All uploaded certificates will be audited against registered government revenue records.\n"
    )
    page2.insert_text((50, 60), p2_text, fontsize=12)
    doc_notice.save(notice_path)
    doc_notice.close()
    print(f"Generated {notice_path}")

    # 2. Synthetic Income Certificate (1 page)
    income_path = os.path.join(FIXTURES_DIR, "synthetic_income_certificate.pdf")
    doc_income = pymupdf.open()
    page_inc = doc_income.new_page(width=595, height=842)
    inc_text = (
        "SYNTHETIC TEST DOCUMENT — NOT AN OFFICIAL CERTIFICATE\n\n"
        "GOVERNMENT REVENUE DEPARTMENT\n"
        "OFFICE OF THE TAHSILDAR, HAVELI TALUKA\n\n"
        "ANNUAL INCOME CERTIFICATE\n"
        "Certificate No: INC/2026/89412\n"
        "Date of Issue: 25/08/2026\n\n"
        "This is to certify that as per revenue verification records, the Annual Family Income of\n"
        "Rahul Ramesh Kumar, resident of Haveli, Pune, Maharashtra,\n"
        "from all sources is assessed at Rs. 1,80,000/- (Rupees One Lakh Eighty Thousand only) per annum.\n\n"
        "Issued by: Tahsildar Office, Haveli\n"
    )
    page_inc.insert_text((50, 60), inc_text, fontsize=12)
    doc_income.save(income_path)
    doc_income.close()
    print(f"Generated {income_path}")

if __name__ == "__main__":
    generate_fixtures()

