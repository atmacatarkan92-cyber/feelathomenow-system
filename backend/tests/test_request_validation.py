from datetime import date

import pytest
from pydantic import ValidationError

from app.api.v1.routes_admin_listings import ListingStatusUpdate
from app.api.v1.routes_admin_rooms import RoomCreate
from app.api.v1.routes_admin_tenancies import TenancyCreate
from app.api.v1.routes_admin_units import UnitCreate
from app.api.v1.routes_invoices import InvoiceGenerateBody
from auth.schemas import LoginRequest


def test_tenancy_create_rejects_move_out_before_move_in():
    with pytest.raises(ValidationError):
        TenancyCreate(
            tenant_id="tenant-1",
            room_id="room-1",
            unit_id="unit-1",
            move_in_date=date(2024, 1, 10),
            move_out_date=date(2024, 1, 9),
            rent_chf=1000,
            deposit_chf=None,
            status="active",
        )


def test_tenancy_create_rejects_negative_rent():
    with pytest.raises(ValidationError):
        TenancyCreate(
            tenant_id="tenant-1",
            room_id="room-1",
            unit_id="unit-1",
            move_in_date=date(2024, 1, 10),
            move_out_date=None,
            rent_chf=-1,
            deposit_chf=None,
            status="active",
        )


def test_room_create_rejects_whitespace_name():
    with pytest.raises(ValidationError):
        RoomCreate(unit_id="unit-1", name="   ", price=10)


def test_unit_create_rejects_negative_rooms():
    with pytest.raises(ValidationError):
        UnitCreate(title="Unit 1", address="Addr", city="City", rooms=-5)


def test_listing_status_update_rejects_invalid_availability_status():
    with pytest.raises(ValidationError):
        ListingStatusUpdate(is_published=True, availability_status="not-allowed")


def test_invoice_generate_body_rejects_invalid_month():
    with pytest.raises(ValidationError):
        InvoiceGenerateBody(year=2024, month=13)


def test_login_request_rejects_whitespace_password():
    with pytest.raises(ValidationError):
        LoginRequest(email="admin@test.example", password="   ")

