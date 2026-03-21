# FeelAtHomeNow - Product Requirements Document

**Project**: Professional Swiss Housing Company Website  
**Last Updated**: March 9, 2026  
**Status**: Backend Complete + Map Integration + Airtable-Ready Structure

---

## Original Problem Statement

Create a professional, modern website for FeelAtHomeNow - a Swiss company providing furnished business apartments, co-living and flexible housing solutions in Switzerland for expats, professionals, students and companies relocating employees.

**Key Requirements**:
- Premium, trustworthy, Swiss, modern and minimal design
- Multi-language support (German default, English)
- Target audiences: Expats/professionals, Companies, Property managers
- Conversion-optimized with psychological triggers
- Agency-quality design ($20,000+ standard)

---

## Architecture & Tech Stack

**Frontend**:
- React 19.0.0
- React Router for navigation
- Tailwind CSS for styling
- Shadcn UI components
- Inter font family
- Context API for language management

**Backend**:
- FastAPI
- MongoDB with Motor (async driver)
- Python 3.11
- SendGrid (for email notifications - pending API key)

**Database Collections**:
- `apartments` - Property listings
- `inquiries` - Contact form submissions

**Design System**:
- Primary Accent: Warm Orange (#FF7A3D)
- Background: White/Off-white
- Text: Dark Charcoal
- Clean, minimal, Swiss-inspired aesthetic

---

## What's Been Implemented

### ✅ Frontend (Complete)
1. **Homepage** - Hero, services, benefits, testimonials, CTA
2. **Apartments Page** - Fetches from API, city filter, clickable property cards
3. **Apartment Detail Page** - Individual property view with:
   - **Image Gallery Slider** with navigation arrows, thumbnails, and image counter
   - **Location Map** using Leaflet/OpenStreetMap (approximate city locations)
   - Large hero image with location badge
   - Title and price (CHF/month)
   - Key features (bedrooms, bathrooms, sqm)
   - Description in selected language
   - Amenities list with checkmarks
   - Contact sidebar with inquiry/call buttons
   - Back navigation to apartment listing
4. **For Companies Page** - Partnership benefits and features
5. **For Property Managers Page** - Value propositions and process
6. **About Page** - Company story, values, statistics
7. **Contact Page** - Form submits to API with success feedback

### ✅ Backend (Complete)
1. **API Endpoints**:
   - `GET /api/health` - Health check
   - `GET /api/apartments` - List all apartments
   - `GET /api/apartments?city={city}` - Filter by city (Zurich, Geneva, Basel, Zug)
   - `GET /api/apartments/{id}` - Single apartment
   - `POST /api/contact` - Submit contact inquiry (saves to DB)
   - `GET /api/admin/inquiries` - List all inquiries

2. **Database**:
   - MongoDB collections: `apartments`, `inquiries`
   - Auto-seeding with 8 apartments on startup
   - Bilingual content (DE/EN) for all fields

3. **Email Service** (Pending Configuration):
   - SendGrid integration code ready
   - Requires API key to activate
   - Sends formatted HTML notifications to info@feelathomenow.ch

### ✅ Verified Working (Test Reports)
- All 17 backend API tests passed (100%)
- All 11 apartment detail page tests passed (100%)
- All 8 image gallery slider tests passed (100%)
- All frontend UI flows working (100%)
- City filters: Zurich (4), Geneva (2), Basel (1), Zug (1)
- Contact form saves to database successfully
- Language switcher (DE/EN) working on all pages
- Apartment card navigation to detail pages working
- Image gallery: navigation, thumbnails, counter, looping all working

---

## API Reference

### Apartments
```
GET /api/apartments
GET /api/apartments?city=Zurich
GET /api/apartments/{apartment_id}
```

Response format:
```json
{
  "id": "apt-001",
  "title": { "de": "...", "en": "..." },
  "location": "Zurich",
  "city": { "de": "Zürich", "en": "Zurich" },
  "price": 3200,
  "bedrooms": 2,
  "bathrooms": 1,
  "sqm": 75,
  "image": "https://...",
  "description": { "de": "...", "en": "..." },
  "amenities": { "de": [...], "en": [...] },
  "is_active": true
}
```

### Contact Form
```
POST /api/contact
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+41 79 123 45 67",
  "company": "Optional Company",
  "message": "Your message here",
  "language": "en"
}
```

---

## File Structure

```
/app
├── backend/
│   ├── server.py          # FastAPI app with all endpoints
│   ├── models.py          # Pydantic models
│   ├── email_service.py   # SendGrid integration
│   ├── seed_data.py       # Initial apartment data
│   ├── requirements.txt
│   └── .env               # MONGO_URL, SENDGRID_API_KEY, etc.
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ApartmentsPage.js  # Fetches from API
    │   │   ├── ContactPage.js     # Posts to API
    │   │   └── ...
    │   ├── contexts/
    │   │   └── LanguageContext.js
    │   └── utils/
    │       └── translations.js
    └── .env               # REACT_APP_API_URL
```

---

## Prioritized Backlog

### P0 - Pending User Action
- [ ] Configure SendGrid API key for email notifications
  - Add key to `/app/backend/.env` as `SENDGRID_API_KEY`
  - Verify sender email in SendGrid dashboard

### P1 - High Priority (Future)
- [ ] Admin Dashboard for apartment management
- [ ] Search and advanced filtering
- [ ] User authentication (optional)
- [ ] Map integration for apartment locations

### P2 - Nice to Have
- [ ] Additional Languages (French, Italian)
- [ ] Virtual apartment tours
- [ ] Online booking system
- [ ] Analytics integration

---

## Environment Variables

### Backend (.env)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
SENDGRID_API_KEY=""           # User to add
SENDER_EMAIL="noreply@feelathomenow.ch"
NOTIFICATION_EMAIL="info@feelathomenow.ch"
```

### Frontend (.env)
```
REACT_APP_API_URL=https://apartment-finder-dev.preview.emergentagent.com
```

---

## Notes

- Email notifications require SendGrid API key (user will configure later)
- All contact form submissions are stored in MongoDB regardless of email status
- Database auto-seeds with 8 apartments if empty
- German is default language, English available via switcher
