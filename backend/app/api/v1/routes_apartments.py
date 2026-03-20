"""
Public marketing API: intentionally unauthenticated.

Returns only published listings (is_published) in the legacy website shape. No admin fields,
no tenant/invoice data. Published listings from all organizations may appear (shared public site);
this is not an org-scoped admin surface.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.services.listings_service import get_listings, get_listing_by_id, get_listing_by_slug
from auth.dependencies import get_db_session
from db.database import engine


router = APIRouter(prefix="/api", tags=["apartments"])


@router.get("/apartments", response_model=List[dict])
async def get_apartments(
    city: Optional[str] = Query(None),
    session=Depends(get_db_session),
):
    """
    Published listings only (PostgreSQL). Same response shape as legacy frontend.
    """
    if engine is None:
        return []
    return get_listings(session, city_code=city)


@router.get("/apartments/{apartment_id}", response_model=dict)
async def get_apartment(apartment_id: str, session=Depends(get_db_session)):
    """
    One published listing by id or slug (tries id first). Unpublished or missing -> 404.
    """
    if engine is None:
        raise HTTPException(status_code=404, detail="Apartment not found")
    listing = get_listing_by_id(session, apartment_id)
    if listing is not None:
        return listing
    listing = get_listing_by_slug(session, apartment_id)
    if listing is not None:
        return listing
    raise HTTPException(status_code=404, detail="Apartment not found")
