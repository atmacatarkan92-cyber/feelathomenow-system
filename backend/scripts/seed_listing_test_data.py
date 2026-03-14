"""
Seed minimal test data for the listing layer so GET /api/apartments returns one listing.

Creates: 1 city, 1 unit, 1 published listing (linked to unit), 1 main image, 2 amenities.

Run from backend directory (after ensure_listing_tables):
  python -m scripts.seed_listing_test_data
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlmodel import select

from db.database import engine, get_session
from db.models import City, Unit, Listing, ListingImage, ListingAmenity


def main():
    if engine is None:
        print("PostgreSQL is not configured.")
        sys.exit(1)

    session = get_session()
    try:
        # Check if we already have a listing (avoid duplicate seed)
        existing = session.exec(select(Listing).where(Listing.slug == "zurich-test-listing")).first()
        if existing:
            print(f"Test listing already exists: id={existing.id}")
            print("GET /api/apartments and GET /api/apartments/{id} should return it.")
            return

        # 1. City
        city = City(
            code="Zurich",
            name_de="Zürich",
            name_en="Zurich",
        )
        session.add(city)
        session.flush()

        # 2. Unit (operational; required for listing.unit_id)
        unit = Unit(
            title="Test Unit Zurich",
            address="Bahnhofstrasse 1",
            city="Zurich",
            rooms=2,
        )
        session.add(unit)
        session.flush()

        # 3. Listing (published so it appears in GET /api/apartments)
        listing = Listing(
            unit_id=unit.id,
            city_id=city.id,
            slug="zurich-test-listing",
            title_de="Testwohnung Zürich",
            title_en="Test Apartment Zurich",
            description_de="Beschreibung der Testwohnung.",
            description_en="Description of the test apartment.",
            price_chf_month=2500,
            bedrooms=2,
            bathrooms=1,
            size_sqm=65,
            is_published=True,
            sort_order=0,
        )
        session.add(listing)
        session.flush()

        # 4. One main image
        img = ListingImage(
            listing_id=listing.id,
            url="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
            is_main=True,
            position=0,
        )
        session.add(img)

        # 5. Two amenities
        session.add(ListingAmenity(listing_id=listing.id, label_de="WLAN", label_en="WiFi"))
        session.add(ListingAmenity(listing_id=listing.id, label_de="Waschmaschine", label_en="Washing machine"))

        session.commit()
        print("Seed data inserted.")
        print(f"  City:   {city.id} ({city.code})")
        print(f"  Unit:   {unit.id}")
        print(f"  Listing: {listing.id} (slug: {listing.slug})")
        print("\nTest in Swagger:")
        print(f"  GET /api/apartments        -> list including this listing")
        print(f"  GET /api/apartments/{listing.id} -> single listing")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
