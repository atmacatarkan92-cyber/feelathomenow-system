"""
Backend API Tests for FeelAtHomeNow
Testing: Apartments API, Contact Form API, Admin Inquiries API
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ==================== Health Check Tests ====================
class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test API health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "feelathomenow-api"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")


# ==================== Apartments API Tests ====================
class TestApartmentsAPI:
    """Apartments CRUD endpoint tests"""
    
    def test_get_all_apartments(self):
        """GET /api/apartments - should return all apartments from database"""
        response = requests.get(f"{BASE_URL}/api/apartments")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
        assert len(apartments) > 0, "Expected at least some apartments in database"
        
        # Verify apartment structure
        first_apt = apartments[0]
        assert "id" in first_apt
        assert "title" in first_apt
        assert "location" in first_apt
        assert "price" in first_apt
        assert "bedrooms" in first_apt
        assert "bathrooms" in first_apt
        assert "sqm" in first_apt
        assert "image" in first_apt
        assert "description" in first_apt
        assert "amenities" in first_apt
        
        # Verify localized fields
        assert "de" in first_apt["title"]
        assert "en" in first_apt["title"]
        
        print(f"✓ GET /api/apartments returned {len(apartments)} apartments")
    
    def test_filter_apartments_by_zurich(self):
        """GET /api/apartments?city=Zurich - should filter apartments by Zurich"""
        response = requests.get(f"{BASE_URL}/api/apartments?city=Zurich")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
        
        # All returned apartments should be in Zurich
        for apt in apartments:
            assert apt["location"] == "Zurich", f"Expected Zurich but got {apt['location']}"
        
        print(f"✓ GET /api/apartments?city=Zurich returned {len(apartments)} Zurich apartments")
    
    def test_filter_apartments_by_basel(self):
        """GET /api/apartments?city=Basel - should return Basel apartments only"""
        response = requests.get(f"{BASE_URL}/api/apartments?city=Basel")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
        
        # All returned apartments should be in Basel
        for apt in apartments:
            assert apt["location"] == "Basel", f"Expected Basel but got {apt['location']}"
        
        print(f"✓ GET /api/apartments?city=Basel returned {len(apartments)} Basel apartments")
    
    def test_filter_apartments_by_geneva(self):
        """GET /api/apartments?city=Geneva - should return Geneva apartments only"""
        response = requests.get(f"{BASE_URL}/api/apartments?city=Geneva")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
        
        for apt in apartments:
            assert apt["location"] == "Geneva", f"Expected Geneva but got {apt['location']}"
        
        print(f"✓ GET /api/apartments?city=Geneva returned {len(apartments)} Geneva apartments")
    
    def test_filter_apartments_by_zug(self):
        """GET /api/apartments?city=Zug - should return Zug apartments only"""
        response = requests.get(f"{BASE_URL}/api/apartments?city=Zug")
        assert response.status_code == 200
        
        apartments = response.json()
        assert isinstance(apartments, list)
        
        for apt in apartments:
            assert apt["location"] == "Zug", f"Expected Zug but got {apt['location']}"
        
        print(f"✓ GET /api/apartments?city=Zug returned {len(apartments)} Zug apartments")
    
    def test_filter_nonexistent_city(self):
        """GET /api/apartments?city=Munich - should return empty list for non-existent city"""
        response = requests.get(f"{BASE_URL}/api/apartments?city=Munich")
        assert response.status_code == 200
        
        apartments = response.json()
        assert apartments == [], "Expected empty list for non-existent city"
        
        print("✓ GET /api/apartments?city=Munich returned empty list (as expected)")
    
    def test_get_single_apartment(self):
        """GET /api/apartments/{id} - should return single apartment by ID"""
        # First get all apartments to find a valid ID
        all_response = requests.get(f"{BASE_URL}/api/apartments")
        apartments = all_response.json()
        
        if apartments:
            apt_id = apartments[0]["id"]
            response = requests.get(f"{BASE_URL}/api/apartments/{apt_id}")
            assert response.status_code == 200
            
            apt = response.json()
            assert apt["id"] == apt_id
            print(f"✓ GET /api/apartments/{apt_id} returned single apartment")
    
    def test_get_nonexistent_apartment(self):
        """GET /api/apartments/fake-id - should return 404 for non-existent apartment"""
        response = requests.get(f"{BASE_URL}/api/apartments/fake-id-12345")
        assert response.status_code == 404
        print("✓ GET /api/apartments/fake-id returned 404 (as expected)")


# ==================== Contact Form API Tests ====================
class TestContactAPI:
    """Contact form submission endpoint tests"""
    
    def test_submit_contact_form_german(self):
        """POST /api/contact - should save contact inquiry with German language"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_User_{unique_id}",
            "email": f"test_{unique_id}@example.com",
            "phone": "+41 44 123 45 67",
            "company": "Test Company AG",
            "message": "This is a test message for the contact form. Testing German language.",
            "language": "de"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "Vielen Dank" in data["message"], "Expected German success message"
        
        print(f"✓ POST /api/contact (German) - Success: {data['message']}")
    
    def test_submit_contact_form_english(self):
        """POST /api/contact - should save contact inquiry with English language"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_User_EN_{unique_id}",
            "email": f"test_en_{unique_id}@example.com",
            "phone": "+41 44 987 65 43",
            "company": "",
            "message": "This is a test message in English. Testing the contact form submission.",
            "language": "en"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "Thank you" in data["message"], "Expected English success message"
        
        print(f"✓ POST /api/contact (English) - Success: {data['message']}")
    
    def test_submit_contact_without_company(self):
        """POST /api/contact - should work without optional company field"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_NoCompany_{unique_id}",
            "email": f"nocompany_{unique_id}@example.com",
            "phone": "+41 76 111 22 33",
            "message": "Testing contact form without company field provided."
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        print("✓ POST /api/contact without company - Success")
    
    def test_submit_contact_invalid_email(self):
        """POST /api/contact - should reject invalid email format"""
        payload = {
            "name": "Test User",
            "email": "invalid-email",
            "phone": "+41 44 123 45 67",
            "message": "This should fail due to invalid email"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 422 validation error for invalid email
        assert response.status_code == 422, f"Expected 422 but got {response.status_code}"
        
        print("✓ POST /api/contact with invalid email - Returned 422 (as expected)")
    
    def test_submit_contact_missing_required_fields(self):
        """POST /api/contact - should reject missing required fields"""
        payload = {
            "name": "Test User",
            # Missing email, phone, message
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 422 validation error
        assert response.status_code == 422
        
        print("✓ POST /api/contact with missing fields - Returned 422 (as expected)")
    
    def test_submit_contact_message_too_short(self):
        """POST /api/contact - should reject message shorter than 10 chars"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_{unique_id}",
            "email": f"short_{unique_id}@example.com",
            "phone": "+41 44 123 45 67",
            "message": "Short"  # Less than 10 chars
        }
        
        response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422
        
        print("✓ POST /api/contact with short message - Returned 422 (as expected)")


# ==================== Admin Inquiries API Tests ====================
class TestAdminInquiriesAPI:
    """Admin inquiries endpoint tests"""
    
    def test_get_all_inquiries(self):
        """GET /api/admin/inquiries - should return all saved inquiries"""
        response = requests.get(f"{BASE_URL}/api/admin/inquiries")
        assert response.status_code == 200
        
        inquiries = response.json()
        assert isinstance(inquiries, list)
        
        print(f"✓ GET /api/admin/inquiries returned {len(inquiries)} inquiries")
        
        # If there are inquiries, verify structure
        if inquiries:
            inquiry = inquiries[0]
            assert "id" in inquiry
            assert "name" in inquiry
            assert "email" in inquiry
            assert "phone" in inquiry
            assert "message" in inquiry
            assert "language" in inquiry
            assert "created_at" in inquiry
            assert "email_sent" in inquiry
            print("✓ Inquiry structure verified")
    
    def test_inquiry_persistence_after_submit(self):
        """Verify that submitted contact form is persisted in inquiries"""
        unique_id = str(uuid.uuid4())[:8]
        test_name = f"TEST_Persistence_{unique_id}"
        test_email = f"persist_{unique_id}@example.com"
        
        # Submit a contact form
        payload = {
            "name": test_name,
            "email": test_email,
            "phone": "+41 44 555 66 77",
            "company": "Persistence Test AG",
            "message": "Testing data persistence in MongoDB database.",
            "language": "en"
        }
        
        submit_response = requests.post(
            f"{BASE_URL}/api/contact",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert submit_response.status_code == 200
        
        # Wait a moment for database write
        time.sleep(0.5)
        
        # Verify it appears in inquiries
        inquiries_response = requests.get(f"{BASE_URL}/api/admin/inquiries")
        assert inquiries_response.status_code == 200
        
        inquiries = inquiries_response.json()
        
        # Find our test inquiry
        found_inquiry = None
        for inq in inquiries:
            if inq["email"] == test_email:
                found_inquiry = inq
                break
        
        assert found_inquiry is not None, f"Could not find inquiry with email {test_email}"
        assert found_inquiry["name"] == test_name
        assert found_inquiry["phone"] == payload["phone"]
        assert found_inquiry["company"] == payload["company"]
        assert found_inquiry["message"] == payload["message"]
        assert found_inquiry["language"] == "en"
        assert found_inquiry["email_sent"] == False, "email_sent should be False since SendGrid is not configured"
        
        print(f"✓ Contact form submission persisted correctly in database")
        print(f"  - email_sent: {found_inquiry['email_sent']} (expected False since SendGrid not configured)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
