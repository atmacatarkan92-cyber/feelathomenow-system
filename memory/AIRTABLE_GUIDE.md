# Airtable Integration Guide for FeelAtHomeNow

## Data Structure Ready for Airtable

The apartment data structure has been prepared for seamless Airtable integration.

### Recommended Airtable Table: "Apartments"

| Field Name | Field Type | Description | Example |
|------------|-----------|-------------|---------|
| ID | Single line text | Unique identifier | apt-001 |
| Title (DE) | Single line text | German title | Moderne 2-Zimmer-Wohnung im Zentrum |
| Title (EN) | Single line text | English title | Modern 2-Bedroom Apartment in City Center |
| City Code | Single select | City identifier | Zurich, Geneva, Basel, Zug |
| City (DE) | Single line text | German city name | Zürich |
| City (EN) | Single line text | English city name | Zurich |
| Latitude | Number | Map latitude | 47.3769 |
| Longitude | Number | Map longitude | 8.5417 |
| Price (CHF/month) | Number | Monthly rent | 3200 |
| Bedrooms | Number | Number of bedrooms | 2 |
| Bathrooms | Number | Number of bathrooms | 1 |
| Size (sqm) | Number | Apartment size | 75 |
| Main Image URL | URL | Primary image | https://images.pexels.com/... |
| Gallery Images | Long text | Comma-separated URLs | url1, url2, url3, url4 |
| Description (DE) | Long text | German description | Stilvolle möblierte Wohnung... |
| Description (EN) | Long text | English description | Stylish furnished apartment... |
| Amenities (DE) | Long text | German amenities (comma-sep) | Voll möbliert, High-Speed Internet... |
| Amenities (EN) | Long text | English amenities (comma-sep) | Fully furnished, High-speed internet... |
| Active | Checkbox | Is listing active | ✓ |

### Sample Data for Import

Copy this to create your first record in Airtable:

```
ID: apt-001
Title (DE): Moderne 2-Zimmer-Wohnung im Zentrum
Title (EN): Modern 2-Bedroom Apartment in City Center
City Code: Zurich
City (DE): Zürich
City (EN): Zurich
Latitude: 47.3769
Longitude: 8.5417
Price (CHF/month): 3200
Bedrooms: 2
Bathrooms: 1
Size (sqm): 75
Main Image URL: https://images.pexels.com/photos/15031994/pexels-photo-15031994.jpeg
Gallery Images: https://images.pexels.com/photos/15031994/pexels-photo-15031994.jpeg, https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg, https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg, https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg
Description (DE): Stilvolle möblierte Wohnung in Top-Lage, perfekt für Professionals und Expats
Description (EN): Stylish furnished apartment in prime location, perfect for professionals and expats
Amenities (DE): Voll möbliert, High-Speed Internet, Küche ausgestattet, Balkon, Waschmaschine
Amenities (EN): Fully furnished, High-speed internet, Equipped kitchen, Balcony, Washing machine
Active: true
```

### City Coordinates Reference

| City | Latitude | Longitude |
|------|----------|-----------|
| Zurich | 47.3769 | 8.5417 |
| Geneva | 46.2044 | 6.1432 |
| Basel | 47.5596 | 7.5886 |
| Zug | 47.1724 | 8.5180 |

## Next Steps

1. Create an Airtable base with the "Apartments" table
2. Add the fields as described above
3. Import the sample data or create new records
4. Get your API key from https://airtable.com/account
5. Find your Base ID from the URL (airtable.com/appXXXXXXXX/...)
6. Provide these credentials to connect the website to Airtable

## API Integration Notes

When connected, the website will:
- Fetch all active apartments from Airtable
- Display them with proper translations (DE/EN)
- Show location maps using coordinates
- Support filtering by city
- Auto-sync when you update Airtable data
