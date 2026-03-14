from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from airtable_service import airtable_service
from app.services.listings_service import get_listings, get_listing_by_id
from db.database import engine, get_session


router = APIRouter(prefix="/api", tags=["apartments"])


@router.get("/apartments", response_model=List[dict])
async def get_apartments(city: Optional[str] = Query(None)):
    """
    Use PostgreSQL listings when DB is configured; else fall back to Airtable.
    Response shape is unchanged for the frontend.
    """
    if engine is not None:
        session = get_session()
        try:
            return get_listings(session, city_code=city)
        finally:
            session.close()

    if airtable_service.is_available():
        return airtable_service.get_all_apartments(city=city)

    return []


@router.get("/apartments/{apartment_id}", response_model=dict)
async def get_apartment(apartment_id: str):
    """
    Use PostgreSQL listing by id when DB is configured; else fall back to Airtable.
    """
    if engine is not None:
        session = get_session()
        try:
            listing = get_listing_by_id(session, apartment_id)
            if listing is not None:
                return listing
        finally:
            session.close()
        raise HTTPException(status_code=404, detail="Apartment not found")

    if airtable_service.is_available():
        apartment = airtable_service.get_apartment_by_id(apartment_id)
        if apartment:
            return apartment

    raise HTTPException(status_code=404, detail="Apartment not found")
