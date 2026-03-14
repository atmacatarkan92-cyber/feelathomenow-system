import os
import logging
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv
from pyairtable import Api

# Load .env file
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Airtable credentials
AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID")
AIRTABLE_TABLE_NAME = os.environ.get("AIRTABLE_TABLE_NAME", "Apartments")


def transform_airtable_record(record: dict) -> dict:
    """Transform Airtable record to apartment format"""
    fields = record.get("fields", {})
    
    # Handle Main Image URL - can be attachment (array) or URL string
    main_image_field = fields.get("Main Image URL", "")
    if isinstance(main_image_field, list) and len(main_image_field) > 0:
        # Attachment field - get URL from first attachment
        main_image = main_image_field[0].get("url", "")
    else:
        main_image = main_image_field if isinstance(main_image_field, str) else ""
    
    # Handle Gallery Images - can be attachment (array) or comma-separated string
    gallery_field = fields.get("Gallery Images", "")
    images = []
    if isinstance(gallery_field, list):
        # Attachment field - extract URLs from each attachment
        images = [att.get("url", "") for att in gallery_field if att.get("url")]
    elif isinstance(gallery_field, str) and gallery_field:
        # Comma-separated URLs
        images = [img.strip() for img in gallery_field.split(",") if img.strip()]
    
    # Ensure main image is in images list
    if main_image and main_image not in images:
        images.insert(0, main_image)
    
    # Parse amenities from comma-separated strings
    amenities_de_str = fields.get("Amenities (DE)", "")
    amenities_en_str = fields.get("Amenities (EN)", "")
    amenities_de = [a.strip() for a in amenities_de_str.split(",") if a.strip()] if amenities_de_str else []
    amenities_en = [a.strip() for a in amenities_en_str.split(",") if a.strip()] if amenities_en_str else []
    
    return {
        "id": fields.get("ID", record.get("id")),
        "title": {
            "de": fields.get("Title (DE)", ""),
            "en": fields.get("Title (EN)", "")
        },
        "location": fields.get("City Code", ""),
        "city": {
            "de": fields.get("City (DE)", ""),
            "en": fields.get("City (EN)", "")
        },
        "coordinates": {
            "lat": fields.get("Latitude", 0) or 0,
            "lng": fields.get("Longitude", 0) or 0
        },
        "price": fields.get("price", 0) or 0,
        "bedrooms": fields.get("Bedrooms", 0) or 0,
        "bathrooms": fields.get("Bathrooms", 0) or 0,
        "sqm": fields.get("Size (sqm)", 0) or 0,
        "image": main_image,
        "images": images if images else [main_image] if main_image else [],
        "description": {
            "de": fields.get("Description (DE)", ""),
            "en": fields.get("Description (EN)", "")
        },
        "amenities": {
            "de": amenities_de,
            "en": amenities_en
        },
        "is_active": fields.get("Active", False)
    }


class AirtableService:
    """Service for fetching apartments from Airtable"""
    
    def __init__(self):
        if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
            logger.warning("Airtable credentials not configured - using fallback to MongoDB")
            self.api = None
            self.table = None
            return
            
        try:
            self.api = Api(AIRTABLE_API_KEY)
            self.table = self.api.table(AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)
            logger.info("Airtable service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Airtable: {e}")
            self.api = None
            self.table = None
    
    def is_available(self) -> bool:
        """Check if Airtable is configured and available"""
        return self.table is not None
    
    def get_all_apartments(self, city: Optional[str] = None) -> List[dict]:
        """Fetch all active apartments from Airtable"""
        if not self.is_available():
            return []
        
        try:
            # Build formula for filtering
            conditions = ["Active = TRUE()"]
            if city:
                conditions.append(f"OR({{City (EN)}} = '{city}', {{City (DE)}} = '{city}')")
            
            formula = f"AND({', '.join(conditions)})" if len(conditions) > 1 else conditions[0]
            
            records = self.table.all(formula=formula)
            apartments = [transform_airtable_record(r) for r in records]
            logger.info(f"Fetched {len(apartments)} apartments from Airtable")
            return apartments
            
        except Exception as e:
            logger.error(f"Error fetching from Airtable: {e}")
            return []
    
    def get_apartment_by_id(self, apartment_id: str) -> Optional[dict]:
        """Fetch a single apartment by ID"""
        if not self.is_available():
            return None
        
        try:
            formula = f"{{ID}} = '{apartment_id}'"
            records = self.table.all(formula=formula, max_records=1)
            
            if records:
                return transform_airtable_record(records[0])
            return None
            
        except Exception as e:
            logger.error(f"Error fetching apartment {apartment_id}: {e}")
            return None


# Global service instance
airtable_service = AirtableService()
