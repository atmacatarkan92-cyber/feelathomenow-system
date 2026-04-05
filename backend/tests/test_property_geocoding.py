"""
Unit tests for property geocoding (mocked HTTP; no external API calls).
"""

from __future__ import annotations

from unittest.mock import MagicMock

from db.models import Property
from app.services import property_geocoding as pg


class TestBuildQueryAndSignature:
    def test_build_query_requires_plz_city_or_line_and_city(self):
        assert pg.build_geocoding_query("A", "1", "3000", "Bern", "CH") is not None
        assert pg.build_geocoding_query(None, None, "3000", "Bern", "CH") is not None
        assert pg.build_geocoding_query("Rue", None, None, "Bern", "CH") is not None
        assert pg.build_geocoding_query(None, None, None, None, "CH") is None

    def test_signature_detects_change(self):
        a = pg.property_address_signature("a", "1", "3000", "Bern", "CH")
        b = pg.property_address_signature("b", "1", "3000", "Bern", "CH")
        assert a != b


class TestGeocodeQueryMocked:
    def test_no_api_key_skipped(self, monkeypatch):
        monkeypatch.delenv("GOOGLE_MAPS_GEOCODING_API_KEY", raising=False)
        monkeypatch.delenv("GOOGLE_MAPS_API_KEY", raising=False)
        st, coords, reason = pg.geocode_query("test query here")
        assert st == "skipped"
        assert coords is None
        assert reason == "provider_unavailable"

    def test_ok_parses_coords(self, monkeypatch):
        monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")

        class Resp:
            def raise_for_status(self):
                pass

            def json(self):
                return {
                    "status": "OK",
                    "results": [
                        {
                            "geometry": {
                                "location": {"lat": 46.95, "lng": 7.44},
                            }
                        }
                    ],
                }

        def fake_get(url, params=None, timeout=None):
            assert "geocode" in url
            return Resp()

        monkeypatch.setattr(pg.requests, "get", fake_get)
        st, coords, reason = pg.geocode_query("Somewhere 1, 3000 Bern, CH")
        assert st == "ok"
        assert coords == (46.95, 7.44)
        assert reason is None


class TestApplyPropertyGeocoding:
    def test_unchanged_does_not_clear_coords(self):
        session = MagicMock()
        p = Property(
            organization_id="org-1",
            title="T",
            street="X",
            zip_code="3000",
            city="Bern",
            country="CH",
            lat=1.0,
            lng=2.0,
        )
        meta = pg.apply_property_geocoding(session, p, address_changed=False)
        assert meta["status"] == "skipped"
        assert meta["reason"] == "unchanged"
        assert p.lat == 1.0 and p.lng == 2.0
        session.add.assert_not_called()

    def test_incomplete_clears_coords(self):
        session = MagicMock()
        p = Property(
            organization_id="org-1",
            title="T",
            street=None,
            house_number=None,
            zip_code=None,
            city=None,
            country="CH",
            lat=5.0,
            lng=6.0,
        )
        meta = pg.apply_property_geocoding(session, p, address_changed=True)
        assert meta["status"] == "skipped"
        assert meta["reason"] == "incomplete_address"
        assert p.lat is None and p.lng is None
        session.add.assert_called_once()

    def test_success_sets_coords(self, monkeypatch):
        monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "k")

        class Resp:
            def raise_for_status(self):
                pass

            def json(self):
                return {
                    "status": "OK",
                    "results": [{"geometry": {"location": {"lat": 47.0, "lng": 8.0}}}],
                }

        monkeypatch.setattr(pg.requests, "get", lambda *a, **k: Resp())

        session = MagicMock()
        p = Property(
            organization_id="org-1",
            title="T",
            street="Bahnhofstrasse",
            house_number="1",
            zip_code="8001",
            city="Zürich",
            country="CH",
        )
        meta = pg.apply_property_geocoding(session, p, address_changed=True)
        assert meta["status"] == "ok"
        assert p.lat == 47.0 and p.lng == 8.0
        session.add.assert_called_once()

    def test_force_skips_unchanged_check(self, monkeypatch):
        """Manual retry: force=True runs geocoding even when address_changed=False."""
        monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "k")

        class Resp:
            def raise_for_status(self):
                pass

            def json(self):
                return {
                    "status": "OK",
                    "results": [{"geometry": {"location": {"lat": 46.0, "lng": 7.0}}}],
                }

        monkeypatch.setattr(pg.requests, "get", lambda *a, **k: Resp())

        session = MagicMock()
        p = Property(
            organization_id="org-1",
            title="T",
            street="Bahnhofstrasse",
            house_number="1",
            zip_code="8001",
            city="Zürich",
            country="CH",
            lat=1.0,
            lng=1.0,
        )
        meta = pg.apply_property_geocoding(session, p, address_changed=False, force=True)
        assert meta["status"] == "ok"
        assert p.lat == 46.0 and p.lng == 7.0

    def test_failure_clears_coords(self, monkeypatch):
        monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "k")

        class Resp:
            def raise_for_status(self):
                pass

            def json(self):
                return {"status": "ZERO_RESULTS", "results": []}

        monkeypatch.setattr(pg.requests, "get", lambda *a, **k: Resp())

        session = MagicMock()
        p = Property(
            organization_id="org-1",
            title="T",
            street="X",
            zip_code="3000",
            city="Bern",
            country="CH",
            lat=9.0,
            lng=9.0,
        )
        meta = pg.apply_property_geocoding(session, p, address_changed=True)
        assert meta["status"] == "failed"
        assert p.lat is None and p.lng is None
