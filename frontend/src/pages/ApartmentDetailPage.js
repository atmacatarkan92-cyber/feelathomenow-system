import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselPrevious, 
  CarouselNext 
} from '../components/ui/carousel';
import { 
  Bed, Bath, Square, MapPin, ArrowLeft, Check, 
  Loader2, Mail, Phone, Building2, ChevronLeft, ChevronRight, Navigation
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

import { API_BASE_URL } from '../config';

const ApartmentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [apartment, setApartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const fetchApartment = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/apartments/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Apartment not found');
          }
          throw new Error('Failed to fetch apartment');
        }
        const data = await response.json();
        setApartment(data);
      } catch (err) {
        console.error('Error fetching apartment:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApartment();
  }, [id]);

  // Track carousel slide changes
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setSelectedImageIndex(carouselApi.selectedScrollSnap());
    };

    carouselApi.on('select', onSelect);
    return () => carouselApi.off('select', onSelect);
  }, [carouselApi]);

  const scrollToImage = useCallback((index) => {
    if (carouselApi) {
      carouselApi.scrollTo(index);
    }
  }, [carouselApi]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF7A3D]" />
      </div>
    );
  }

  if (error || !apartment) {
    return (
      <div className="min-h-screen pt-20">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {language === 'de' ? 'Wohnung nicht gefunden' : 'Apartment Not Found'}
          </h1>
          <p className="text-gray-600 mb-8">
            {language === 'de' 
              ? 'Die gesuchte Wohnung existiert nicht oder wurde entfernt.'
              : 'The apartment you are looking for does not exist or has been removed.'}
          </p>
          <Button 
            onClick={() => navigate('/apartments')}
            className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {language === 'de' ? 'Zurück zu Wohnungen' : 'Back to Apartments'}
          </Button>
        </div>
      </div>
    );
  }

  const texts = {
    de: {
      backToApartments: 'Zurück zu Wohnungen',
      perMonth: 'pro Monat',
      bedrooms: 'Schlafzimmer',
      bathrooms: 'Badezimmer',
      size: 'Grösse',
      description: 'Beschreibung',
      amenities: 'Ausstattung',
      location: 'Standort',
      approximateLocation: 'Ungefährer Standort in',
      contactUs: 'Kontaktieren Sie uns',
      contactText: 'Interessiert an dieser Wohnung? Kontaktieren Sie uns für eine Besichtigung oder weitere Informationen.',
      sendInquiry: 'Anfrage senden',
      callUs: 'Anrufen',
      photos: 'Fotos',
    },
    en: {
      backToApartments: 'Back to Apartments',
      perMonth: 'per month',
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      size: 'Size',
      description: 'Description',
      amenities: 'Amenities',
      location: 'Location',
      approximateLocation: 'Approximate location in',
      contactUs: 'Contact Us',
      contactText: 'Interested in this apartment? Contact us for a viewing or more information.',
      sendInquiry: 'Send Inquiry',
      callUs: 'Call Us',
      photos: 'Photos',
    }
  };

  const t = texts[language] || texts.de;

  // Get images array - fall back to single image if images array doesn't exist
  const images = apartment.images && apartment.images.length > 0 
    ? apartment.images 
    : [apartment.image];

  return (
    <div className="min-h-screen pt-20 bg-gray-50">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/apartments')}
          className="text-gray-600 hover:text-[#FF7A3D] hover:bg-[#FF7A3D]/5 -ml-2"
          data-testid="back-to-apartments-btn"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.backToApartments}
        </Button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <div className="space-y-4">
              {/* Main Carousel */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <Carousel 
                  className="w-full" 
                  setApi={setCarouselApi}
                  opts={{ loop: true }}
                >
                  <CarouselContent>
                    {images.map((img, index) => (
                      <CarouselItem key={index}>
                        <div className="relative">
                          <img
                            src={img}
                            alt={`${apartment.title[language]} - ${index + 1}`}
                            className="w-full h-[400px] md:h-[500px] object-cover"
                            data-testid={`apartment-image-${index}`}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  
                  {/* Custom Navigation Buttons */}
                  {images.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg z-10"
                        onClick={() => carouselApi?.scrollPrev()}
                        data-testid="gallery-prev-btn"
                      >
                        <ChevronLeft className="h-6 w-6 text-gray-800" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white shadow-lg z-10"
                        onClick={() => carouselApi?.scrollNext()}
                        data-testid="gallery-next-btn"
                      >
                        <ChevronRight className="h-6 w-6 text-gray-800" />
                      </Button>
                    </>
                  )}
                </Carousel>

                {/* Location Badge */}
                <div className="absolute top-4 left-4 z-10">
                  <div className="flex items-center bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                    <MapPin className="h-4 w-4 mr-1.5 text-[#FF7A3D]" />
                    <span className="text-sm font-medium text-gray-900">
                      {apartment.city[language]}
                    </span>
                  </div>
                </div>

                {/* Image Counter */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 right-4 z-10">
                    <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <span className="text-sm font-medium text-white" data-testid="image-counter">
                        {selectedImageIndex + 1} / {images.length}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 px-1" data-testid="thumbnail-strip">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToImage(index)}
                      className={`flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200 ${
                        selectedImageIndex === index 
                          ? 'ring-2 ring-[#FF7A3D] ring-offset-2' 
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      data-testid={`thumbnail-${index}`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="w-20 h-14 md:w-24 md:h-16 object-cover"
                        data-testid={`apartment-image-${index}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title and Price - Mobile */}
            <div className="lg:hidden">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4" data-testid="apartment-title">
                {apartment.title[language]}
              </h1>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#FF7A3D]">
                  CHF {apartment.price.toLocaleString()}
                </span>
                <span className="text-gray-500">{t.perMonth}</span>
              </div>
            </div>

            {/* Key Features */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-gray-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <Bed className="h-8 w-8 mx-auto mb-3 text-[#FF7A3D]" />
                  <p className="text-2xl font-bold text-gray-900">{apartment.bedrooms}</p>
                  <p className="text-sm text-gray-600">{t.bedrooms}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <Bath className="h-8 w-8 mx-auto mb-3 text-[#FF7A3D]" />
                  <p className="text-2xl font-bold text-gray-900">{apartment.bathrooms}</p>
                  <p className="text-sm text-gray-600">{t.bathrooms}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-100 hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <Square className="h-8 w-8 mx-auto mb-3 text-[#FF7A3D]" />
                  <p className="text-2xl font-bold text-gray-900">{apartment.sqm}</p>
                  <p className="text-sm text-gray-600">m²</p>
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            <Card className="border-gray-100">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {t.description}
                </h2>
                <p className="text-gray-600 leading-relaxed text-lg" data-testid="apartment-description">
                  {apartment.description[language]}
                </p>
              </CardContent>
            </Card>

            {/* Amenities */}
            <Card className="border-gray-100">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  {t.amenities}
                </h2>
                <div className="grid sm:grid-cols-2 gap-4" data-testid="apartment-amenities">
                  {apartment.amenities[language].map((amenity, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#FF7A3D]/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-4 w-4 text-[#FF7A3D]" />
                      </div>
                      <span className="text-gray-700">{amenity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Location Map */}
            {apartment.coordinates && (
              <Card className="border-gray-100">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Navigation className="h-5 w-5 text-[#FF7A3D]" />
                    <h2 className="text-xl font-semibold text-gray-900">
                      {t.location}
                    </h2>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    {t.approximateLocation} {apartment.city[language]}
                  </p>
<div className="rounded-xl overflow-hidden shadow-md" data-testid="apartment-map">

  {!showMap ? (
    <div className="h-[280px] flex items-center justify-center bg-gray-100">
      <Button
        onClick={() => setShowMap(true)}
        className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
      >
        {language === 'de' ? 'Karte laden' : 'Load map'}
      </Button>
    </div>
  ) : (

    <MapContainer
      center={[apartment.coordinates.lat, apartment.coordinates.lng]}
      zoom={14}
      style={{ height: '280px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[apartment.coordinates.lat, apartment.coordinates.lng]}>
        <Popup>
          <div className="text-center">
            <p className="font-semibold">{apartment.title[language]}</p>
            <p className="text-sm text-gray-600">{apartment.city[language]}</p>
          </div>
        </Popup>
      </Marker>
    </MapContainer>

  )}

</div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Right Side */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Price Card - Desktop */}
              <Card className="border-gray-100 shadow-xl hidden lg:block">
                <CardContent className="p-6">
                  <h1 className="text-2xl font-bold text-gray-900 mb-4" data-testid="apartment-title-desktop">
                    {apartment.title[language]}
                  </h1>
                  <div className="flex items-baseline gap-2 mb-6 pb-6 border-b border-gray-100">
                    <span className="text-4xl font-bold text-[#FF7A3D]" data-testid="apartment-price">
                      CHF {apartment.price.toLocaleString()}
                    </span>
                    <span className="text-gray-500">{t.perMonth}</span>
                  </div>
                  
                  {/* Quick Stats */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-gray-600">
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4 text-[#FF7A3D]" />
                        <span>{t.bedrooms}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{apartment.bedrooms}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <div className="flex items-center gap-2">
                        <Bath className="h-4 w-4 text-[#FF7A3D]" />
                        <span>{t.bathrooms}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{apartment.bathrooms}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <div className="flex items-center gap-2">
                        <Square className="h-4 w-4 text-[#FF7A3D]" />
                        <span>{t.size}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{apartment.sqm} m²</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#FF7A3D]" />
                        <span>Location</span>
                      </div>
                      <span className="font-semibold text-gray-900">{apartment.city[language]}</span>
                    </div>
                  </div>

                  {/* Photo Count */}
                  {images.length > 1 && (
                    <div className="flex items-center justify-between text-gray-600 pt-4 border-t border-gray-100">
                      <span>{t.photos}</span>
                      <span className="font-semibold text-gray-900">{images.length}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card className="border-gray-100 shadow-xl bg-gradient-to-br from-[#2C3E50] to-[#34495E]">
                <CardContent className="p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{t.contactUs}</h3>
                      <p className="text-sm text-gray-300">FeelAtHomeNow</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-6">
                    {t.contactText}
                  </p>

                  <div className="space-y-3">
                    <Link to="/contact" className="block">
                      <Button 
                        className="w-full bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
                        data-testid="apartment-inquiry-btn"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {t.sendInquiry}
                      </Button>
                    </Link>
                    <a href="tel:+41442221100" className="block">
                      <Button 
                        variant="outline" 
                        className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white"
                        data-testid="apartment-call-btn"
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        {t.callUs}
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApartmentDetailPage;
