"""Tests for health check endpoint."""

from fastapi.testclient import TestClient


def test_health_endpoint_returns_ok(client: TestClient):
    """Verify health route returns status 200 and standard health payload."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "saarthi-ai-service"
    assert data["version"] == "1.0.0"

