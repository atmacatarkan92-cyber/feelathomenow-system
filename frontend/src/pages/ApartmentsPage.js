import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Bed, Bath, Square, MapPin, ArrowRight, Loader2 } from 'lucide-react';

import { API_BASE_URL } from '../config';

const cityMap = {
    zuerich: 'Zurich',
    basel: 'Basel',
    bern: 'Bern',
    genf: 'Geneva',
  };

const ApartmentsPage = () => {
  const { t, language } = useLanguage();
  const { city } = useParams();
  const [selectedCity, setSelectedCity] = useState(null);
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
const [sortOrder, setSortOrder] = useState('default');

  const cities = [
    { value: 'all', label: t.apartmentsPage.filterAll },
    { value: 'Zurich', label: t.apartmentsPage.filterZurich },
    { value: 'Basel', label: t.apartmentsPage.filterBasel },
    { value: 'Bern', label: 'Bern' },
    { value: 'Geneva', label: t.apartmentsPage.filterGeneva },
  ];

  useEffect(() => {
    if (!city) {
      setSelectedCity('all');
        document.title = 'Furnished Apartments Switzerland | FeelAtHomeNow';
      return;
    }

  const mappedCity = cityMap[city.toLowerCase()] || 'all';
  setSelectedCity(mappedCity);
    document.title = `Furnished Apartments ${mappedCity} | FeelAtHomeNow`;
}, [city]);

useEffect(() => {
  window.scrollTo(0, 0);
}, [selectedCity]);

  useEffect(() => {
    if (selectedCity === null) return;
    const fetchApartments = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = selectedCity === 'all'
          ? `${API_BASE_URL}/api/apartments`
          : `${API_BASE_URL}/api/apartments?city=${selectedCity}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch apartments');
        
        const data = await response.json();
        setApartments(data);
      } catch (err) {
        console.error('Error fetching apartments:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApartments();
  }, [selectedCity]);

    const filteredApartments = [...apartments].sort((a, b) => {
    const priceA = Number(String(a.price).replace(/[^0-9.-]+/g, '')) || 0;
    const priceB = Number(String(b.price).replace(/[^0-9.-]+/g, '')) || 0;

    if (sortOrder === 'price-asc') return priceA - priceB;
    if (sortOrder === 'price-desc') return priceB - priceA;

    return 0;
    });
    
return (
<div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t.apartmentsPage.title}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t.apartmentsPage.subtitle}
            </p>
          </div>

          {/* City Filter */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-12">
            {cities.map((city) => (
              <Button
                key={city.value}
                variant={selectedCity === city.value ? "default" : "outline"}
               onClick={() => {
              setSelectedCity(city.value)
              setSortOrder('default')
              
            }}
                className={`${
                  selectedCity === city.value
                    ? 'bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white'
                    : 'border-gray-300 text-gray-700 hover:border-[#FF7A3D] hover:text-[#FF7A3D]'
                    } transition-all duration-200`}
              >
                {city.label}
              </Button>
                  ))}
<select
value={sortOrder}
onChange={(e) => setSortOrder(e.target.value)}
className="h-10 rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-700"
>
<option value="default">Sortierung</option>
<option value="price-asc">Preis aufsteigend</option>
<option value="price-desc">Preis absteigend</option>
</select>

          </div>



          {/* Apartments Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-[#FF7A3D]" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-xl text-red-600">
                {language === 'de' 
                  ? 'Fehler beim Laden der Wohnungen.' 
                  : 'Error loading apartments.'}
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="mt-4 bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
              >
                {language === 'de' ? 'Erneut versuchen' : 'Try again'}
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredApartments.map((apartment) => (
              <Link 
                key={apartment.id} 
                to={`/apartments/${apartment.id}`}
                className="block"
                data-testid={`apartment-card-${apartment.id}`}
              >
                <Card 
                  className="group overflow-hidden border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer h-full"
                >
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={apartment.image}
                      alt={apartment.title[language]}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg">
                      <p className="text-sm font-semibold text-gray-900">
                        CHF {apartment.price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">{t.apartmentsPage.perMonth}</p>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <MapPin className="h-4 w-4 mr-1 text-[#FF7A3D]" />
                      {apartment.city[language]}
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {apartment.title[language]}
                  </h3>
                  
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {apartment.description[language]}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 mr-1 text-[#FF7A3D]" />
                      <span>{apartment.bedrooms} {t.apartmentsPage.bedrooms}</span>
                    </div>
                    <div className="flex items-center">
                      <Bath className="h-4 w-4 mr-1 text-[#FF7A3D]" />
                      <span>{apartment.bathrooms} {t.apartmentsPage.bathrooms}</span>
                    </div>
                    <div className="flex items-center">
                      <Square className="h-4 w-4 mr-1 text-[#FF7A3D]" />
                      <span>{apartment.sqm} {t.apartmentsPage.sqm}</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white group/btn"
                    data-testid={`view-apartment-${apartment.id}`}
                  >
                    {t.apartmentsPage.viewDetails}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
              </Link>
            ))}
          </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredApartments.length === 0 && (
<div className="text-center py-16">
  <h2 className="text-2xl font-semibold mb-4">
    {language === 'de'
      ? 'Momentan keine Wohnungen in dieser Stadt verfügbar'
      : 'Currently no apartments available in this city'}
  </h2>

  <p className="text-gray-600 max-w-xl mx-auto mb-6">
    {language === 'de'
      ? 'Wir erhalten laufend neue möblierte Wohnungen. Senden Sie uns eine kurze Anfrage und wir informieren Sie sofort, sobald eine passende Wohnung verfügbar ist.'
      : 'We continuously receive new furnished apartments. Send us a request and we will inform you as soon as a suitable apartment becomes available.'}
  </p>

  <Link
    to={selectedCity !== 'all' ? `/contact?city=${selectedCity}` : '/contact'}
    className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition"
>
    {language === 'de'
    ? 'Wohnungsanfrage senden →'
    : 'Send apartment request →'}
</Link>
            </div>
          )}
  </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-[#2C3E50] to-[#34495E]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {language === 'de' 
              ? 'Nicht das Richtige gefunden?' 
              : "Didn't Find What You're Looking For?"}
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            {language === 'de'
              ? 'Kontaktieren Sie uns für individuelle Anfragen und massgeschneiderte Lösungen.'
              : 'Contact us for custom requests and tailored solutions.'}
          </p>
          <Button 
            size="lg"
            className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-8 py-6 text-lg"
            onClick={() => window.location.href = '/contact'}
          >
            {t.nav.contact}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ApartmentsPage;
