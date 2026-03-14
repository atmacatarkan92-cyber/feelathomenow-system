from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid


class LocalizedField(BaseModel):
    de: str
    en: str


class ApartmentBase(BaseModel):
    title: LocalizedField
    location: str
    city: LocalizedField
    price: int
    bedrooms: int
    bathrooms: int
    sqm: int
    image: str
    description: LocalizedField
    amenities: Dict[str, List[str]]


class ApartmentCreate(ApartmentBase):
    pass


class Apartment(ApartmentBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True


class ContactInquiryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=5, max_length=30)
    company: Optional[str] = Field(default="", max_length=100)
    message: str = Field(..., min_length=10, max_length=2000)
    language: Optional[str] = Field(default="de")
    apartment_id: Optional[str] = Field(default=None)


class ContactInquiry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    company: str
    message: str
    language: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    email_sent: bool = False


class ContactResponse(BaseModel):
    success: bool
    message: str
