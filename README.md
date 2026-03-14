# FeelAtHomeNow Website

Professional website for FeelAtHomeNow - a Swiss company providing furnished business apartments and flexible housing solutions.

## Features

- **Multi-language Support**: German (default) and English
- **Apartment Listings**: Fetched from Airtable (with MongoDB fallback)
- **Image Gallery**: Carousel slider with thumbnails for each apartment
- **Location Maps**: Interactive Leaflet/OpenStreetMap showing approximate locations
- **Contact Form**: Saves inquiries to database with optional email notifications
- **Responsive Design**: Mobile-friendly, modern UI with TailwindCSS

## Tech Stack

- **Frontend**: React, TailwindCSS, Shadcn UI, React Router
- **Backend**: FastAPI, Python
- **Database**: MongoDB (for contact inquiries), Airtable (for apartments)
- **Maps**: Leaflet with OpenStreetMap
- **Email**: SendGrid (optional)

## Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB
- Airtable account (for apartment management)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Edit .env with your credentials:
# - MONGO_URL
# - AIRTABLE_API_KEY
# - AIRTABLE_BASE_ID
# - SENDGRID_API_KEY (optional)

# Run the server
uvicorn server:app --reload --port 8001
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env

# Edit .env with your backend URL
# REACT_APP_BACKEND_URL=http://localhost:8001

# Run the development server
yarn start
```

## Airtable Configuration

Create a table named "Apartments" with these fields:

| Field | Type |
|-------|------|
| ID | Single line text |
| Title (DE) | Single line text |
| Title (EN) | Single line text |
| City Code | Single select (Zurich, Geneva, Basel, Zug) |
| City (DE) | Single line text |
| City (EN) | Single line text |
| Latitude | Number |
| Longitude | Number |
| Price (CHF/month) | Number |
| Bedrooms | Number |
| Bathrooms | Number |
| Size (sqm) | Number |
| Main Image URL | Attachment |
| Gallery Images | Attachment |
| Description (DE) | Long text |
| Description (EN) | Long text |
| Amenities (DE) | Long text (comma-separated) |
| Amenities (EN) | Long text (comma-separated) |
| Active | Checkbox |

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/apartments` - List all apartments
- `GET /api/apartments?city=Zurich` - Filter by city
- `GET /api/apartments/{id}` - Get single apartment
- `POST /api/contact` - Submit contact inquiry

## Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| MONGO_URL | MongoDB connection string |
| DB_NAME | Database name |
| AIRTABLE_API_KEY | Airtable Personal Access Token |
| AIRTABLE_BASE_ID | Airtable Base ID |
| AIRTABLE_TABLE_NAME | Table name (default: "Apartments") |
| SENDGRID_API_KEY | SendGrid API key (optional) |
| SENDER_EMAIL | From email for notifications |
| NOTIFICATION_EMAIL | Email to receive contact notifications |

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| REACT_APP_BACKEND_URL | Backend API URL |

## License

Private - FeelAtHomeNow
