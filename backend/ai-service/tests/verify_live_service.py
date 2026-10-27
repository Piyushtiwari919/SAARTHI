"""Script to verify live server startup, health route, authentication, and extraction."""

import io
import subprocess
import sys
import time
import httpx
import pymupdf

INTERNAL_TOKEN = "verify_live_secret_token_abc"


def make_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(pymupdf.Point(50, 72), text)
    b = doc.tobytes()
    doc.close()
    return b


def main():
    print("=== Starting live Uvicorn server on 127.0.0.1:8000 ===")
    env = dict(**sys.modules["os"].environ)
    env["INTERNAL_SERVICE_TOKEN"] = INTERNAL_TOKEN
    env["AI_PROVIDER"] = "local"

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    try:
        # 1. Wait for server to become responsive
        client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=5.0)
        ready = False
        for _ in range(25):
            try:
                r = client.get("/health")
                if r.status_code == 200:
                    ready = True
                    break
            except Exception:
                time.sleep(0.3)

        if not ready:
            print("ERROR: Server failed to start within timeout.")
            stdout, stderr = proc.communicate(timeout=2)
            print("STDOUT:", stdout)
            print("STDERR:", stderr)
            sys.exit(1)

        print("[PASS] GET /health responded with 200 OK:", r.json())

        # 2. Test missing auth token
        income_pdf = make_pdf(
            "GOVERNMENT OF MAHARASHTRA\n"
            "Office of the Tahsildar, Haveli\n"
            "Certificate No: INC/2024/99120\n"
            "Date of Issue: 20/09/2024\n"
            "Annual Family Income: Rs. 1,80,000/-"
        )
        r_unauth = client.post(
            "/internal/v1/documents/extract",
            files={"file": ("doc.pdf", io.BytesIO(income_pdf), "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert r_unauth.status_code == 401, f"Expected 401, got {r_unauth.status_code}"
        assert r_unauth.json()["error_code"] == "UNAUTHORIZED_INTERNAL_CALL"
        print("[PASS] Missing auth token rejected with 401 UNAUTHORIZED_INTERNAL_CALL")

        # 3. Test incorrect auth token
        r_wrong = client.post(
            "/internal/v1/documents/extract",
            headers={"X-Internal-Service-Token": "invalid-token"},
            files={"file": ("doc.pdf", io.BytesIO(income_pdf), "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert r_wrong.status_code == 401
        assert r_wrong.json()["error_code"] == "UNAUTHORIZED_INTERNAL_CALL"
        print("[PASS] Incorrect auth token rejected with 401 UNAUTHORIZED_INTERNAL_CALL")

        # 4. Test valid income extraction
        headers = {"X-Internal-Service-Token": INTERNAL_TOKEN}
        r_extract = client.post(
            "/internal/v1/documents/extract",
            headers=headers,
            files={"file": ("income.pdf", io.BytesIO(income_pdf), "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert r_extract.status_code == 200, f"Expected 200, got {r_extract.status_code}: {r_extract.text}"
        data = r_extract.json()
        assert data["processing_status"] == "COMPLETED"
        assert data["document_type"] == "INCOME_CERTIFICATE"
        income_val = next(f["value"] for f in data["extracted_fields"] if f["field"] == "annual_family_income")
        assert income_val == 180000
        print("[PASS] Income extraction succeeded with 200 OK: income =", income_val)

        # 5. Test valid scholarship notice extraction
        scholarship_pdf = make_pdf(
            "MERIT SCHOLARSHIP 2024\n"
            "MINISTRY OF EDUCATION\n"
            "Application Deadline: 31/12/2024\n"
            "Required Documents: Income Certificate, Marksheet\n"
            "Eligibility Criteria: Annual family income must not exceed Rs. 2,50,000\n"
            "Minimum 60% marks required"
        )
        r_schol = client.post(
            "/internal/v1/documents/extract",
            headers=headers,
            files={"file": ("scholarship.pdf", io.BytesIO(scholarship_pdf), "application/pdf")},
            data={"document_type": "SCHOLARSHIP_NOTICE"},
        )
        assert r_schol.status_code == 200
        schol_data = r_schol.json()
        assert schol_data["processing_status"] == "COMPLETED"
        assert len(schol_data["eligibility_rules"]) == 2
        print("[PASS] Scholarship notice extraction succeeded with 200 OK, rules count:", len(schol_data["eligibility_rules"]))

        # 6. Test invalid file (empty file)
        r_empty = client.post(
            "/internal/v1/documents/extract",
            headers=headers,
            files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
            data={"document_type": "INCOME_CERTIFICATE"},
        )
        assert r_empty.status_code == 400
        assert r_empty.json()["error_code"] == "EMPTY_FILE"
        print("[PASS] Empty file rejected with 400 EMPTY_FILE")

        print("=== ALL LIVE VERIFICATION CHECKS PASSED ===")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()

