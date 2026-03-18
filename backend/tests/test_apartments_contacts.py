"""
Backend API tests (in-process) for FeelAtHomeNow.
Uses FastAPI TestClient via the shared `client` fixture.
"""

import uuid

import pytest

# ==================== Health Check Tests ====================
class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self, client):
        """Test API health endpoint returns healthy status"""
        response = client.get("/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "feelathomenow-api"
        assert "timestamp" in data


# ==================== Apartments API Tests ====================
class TestApartmentsAPI:
    """Apartments CRUD endpoint tests"""
    
    def test_get_all_apartments(self, client):
        """GET /api/apartments - returns [] when DB is not configured in tests."""
        response = client.get("/api/apartments")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
    
    def test_filter_apartments_by_zurich(self, client):
        """GET /api/apartments?city=Zurich - should return a list (may be empty in tests)."""
        response = client.get("/api/apartments?city=Zurich")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
    
    def test_filter_nonexistent_city(self, client):
        """GET /api/apartments?city=Munich - should return empty list when DB is not configured."""
        response = client.get("/api/apartments?city=Munich")
        assert response.status_code == 200
        
        apartments = response.json()
        assert apartments == []
    
    def test_get_nonexistent_apartment(self, client):
        """GET /api/apartments/fake-id - should return 404 for non-existent apartment"""
        response = client.get("/api/apartments/fake-id-12345")
        assert response.status_code == 404


# ==================== Contact Form API Tests ====================
class TestContactAPI:
    """Contact form submission endpoint tests"""
    
    def test_submit_contact_form_german(self, client):
        """POST /api/contact - should accept valid payload and return success."""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_User_{unique_id}",
            "email": f"test_{unique_id}@example.com",
            "phone": "+41 44 123 45 67",
            "company": "Test Company AG",
            "message": "This is a test message for the contact form. Testing German language.",
            "language": "de"
        }
        
        response = client.post("/api/contact", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "Vielen Dank" in (data.get("message") or "")
    
    def test_submit_contact_form_english(self, client):
        """POST /api/contact - should accept valid payload and return success."""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_User_EN_{unique_id}",
            "email": f"test_en_{unique_id}@example.com",
            "phone": "+41 44 987 65 43",
            "company": "",
            "message": "This is a test message in English. Testing the contact form submission.",
            "language": "en"
        }
        
        response = client.post("/api/contact", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "Vielen Dank" in (data.get("message") or "")
    
    def test_submit_contact_without_company(self, client):
        """POST /api/contact - should work without optional company field."""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_NoCompany_{unique_id}",
            "email": f"nocompany_{unique_id}@example.com",
            "phone": "+41 76 111 22 33",
            "message": "Testing contact form without company field provided."
        }
        
        response = client.post("/api/contact", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") is True
        assert "Vielen Dank" in (data.get("message") or "")
    
    def test_submit_contact_invalid_email(self, client):
        """POST /api/contact - should reject invalid email format"""
        payload = {
            "name": "Test User",
            "email": "invalid-email",
            "phone": "+41 44 123 45 67",
            "message": "This should fail due to invalid email"
        }
        
        response = client.post("/api/contact", json=payload)
        
        # Should return 422 validation error for invalid email
        assert response.status_code == 422, f"Expected 422 but got {response.status_code}"
        
        print("✓ POST /api/contact with invalid email - Returned 422 (as expected)")
    
    def test_submit_contact_missing_required_fields(self, client):
        """POST /api/contact - should reject missing required fields"""
        payload = {
            "name": "Test User",
            # Missing email, phone, message
        }
        response = client.post("/api/contact", json=payload)
        
        # Should return 422 validation error
        assert response.status_code == 422
        
        print("✓ POST /api/contact with missing fields - Returned 422 (as expected)")
    
    def test_submit_contact_message_too_short(self, client):
        """POST /api/contact - should reject message shorter than 10 chars"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_{unique_id}",
            "email": f"short_{unique_id}@example.com",
            "phone": "+41 44 123 45 67",
            "message": "Short"  # Less than 10 chars
        }
        
        response = client.post("/api/contact", json=payload)
        
        assert response.status_code == 422
        
        print("✓ POST /api/contact with short message - Returned 422 (as expected)")


# ==================== Admin Inquiries API Tests ====================
class TestAdminInquiriesAPI:
    """Admin inquiries endpoint tests"""
    
    def test_get_all_inquiries_unauthenticated_rejected(self, client):
        """GET /api/admin/inquiries - protected by HTTPBearer; without auth should be rejected."""
        response = client.get("/api/admin/inquiries")
        assert response.status_code in (401, 403)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
