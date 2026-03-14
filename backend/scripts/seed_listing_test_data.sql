-- Minimal test data for GET /api/apartments (one city, one unit, one listing, one image, two amenities).
-- Run only after tables exist (e.g. python -m scripts.ensure_listing_tables).
-- Prefer the Python seed (scripts/seed_listing_test_data.py) so IDs are consistent.

-- Fixed UUIDs for references (PostgreSQL format)
-- 1. City
INSERT INTO cities (id, code, name_de, name_en)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Zurich', 'Zürich', 'Zurich')
ON CONFLICT (code) DO NOTHING;

-- 2. Unit (table name is "unit")
INSERT INTO unit (id, title, address, city, rooms, created_at)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Test Unit Zurich', 'Bahnhofstrasse 1', 'Zurich', 2, NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Listing (is_published = true so it appears in GET /api/apartments)
INSERT INTO listings (id, unit_id, city_id, slug, title_de, title_en, description_de, description_en,
                      price_chf_month, bedrooms, bathrooms, size_sqm, is_published, sort_order, created_at, updated_at)
VALUES ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'zurich-test-listing', 'Testwohnung Zürich', 'Test Apartment Zurich',
        'Beschreibung der Testwohnung.', 'Description of the test apartment.',
        2500, 2, 1, 65, true, 0, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- 4. One main image
INSERT INTO listing_images (id, listing_id, url, is_main, position)
VALUES (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', true, 0);

-- 5. Two amenities
INSERT INTO listing_amenities (id, listing_id, label_de, label_en)
VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'WLAN', 'WiFi'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'Waschmaschine', 'Washing machine');
