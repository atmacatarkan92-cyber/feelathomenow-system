import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { MapPin, Clock, Package, Headphones, CheckCircle, ArrowRight } from 'lucide-react';

const ForCompaniesPage = () => {
  const { t, language } = useLanguage();

  const features = [
    {
      icon: MapPin,
      title: t.companiesPage.feature1Title,
      desc: t.companiesPage.feature1Desc,
    },
    {
      icon: Clock,
      title: t.companiesPage.feature2Title,
      desc: t.companiesPage.feature2Desc,
    },
    {
      icon: Package,
      title: t.companiesPage.feature3Title,
      desc: t.companiesPage.feature3Desc,
    },
    {
      icon: Headphones,
      title: t.companiesPage.feature4Title,
      desc: t.companiesPage.feature4Desc,
    },
  ];

  const benefits = [
    language === 'de' ? 'Sofortige Verfügbarkeit von möblierten Apartments' : 'Immediate availability of furnished apartments',
    language === 'de' ? 'Flexible Mietverträge ab 1 Monat' : 'Flexible rental contracts from 1 month',
    language === 'de' ? 'Alle Nebenkosten inklusive' : 'All utilities included',
    language === 'de' ? 'Professionelle Betreuung 24/7' : 'Professional support 24/7',
    language === 'de' ? 'Zentrale Lagen in allen grossen Städten' : 'Central locations in all major cities',
    language === 'de' ? 'Massgeschneiderte Lösungen für Ihr Unternehmen' : 'Tailored solutions for your company',
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {t.companiesPage.title}
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {t.companiesPage.subtitle}
              </p>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                {t.companiesPage.heroText}
              </p>
              <Button 
                size="lg"
                className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
                onClick={() => window.location.href = '/contact'}
              >
                {t.companiesPage.ctaButton}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="relative">
             <img
              src="/bild-unternehmen-page.png"
              alt="Corporate Housing Switzerland"
              className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
            />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Why FeelAtHomeNow Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t.companiesPage.whyTitle}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[#FF7A3D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-8 w-8 text-[#FF7A3D]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'de' ? 'Ihre Vorteile' : 'Your Benefits'}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start space-x-3 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <CheckCircle className="h-6 w-6 text-[#FF7A3D] flex-shrink-0 mt-1" />
                <p className="text-gray-700 text-lg">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Gallery Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden shadow-lg group">
              <img
                src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg"
                alt="Team collaboration"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden shadow-lg group">
              <img
                src="https://images.pexels.com/photos/6950015/pexels-photo-6950015.jpeg"
                alt="Business meeting"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden shadow-lg group">
              <img
                src="https://images.pexels.com/photos/7688457/pexels-photo-7688457.jpeg"
                alt="Diverse team"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#2C3E50] to-[#34495E]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {t.companiesPage.ctaTitle}
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            {t.companiesPage.ctaText}
          </p>
          <Button 
            size="lg"
            className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-10 py-6 text-lg"
            onClick={() => window.location.href = '/contact'}
          >
            {t.companiesPage.ctaButton}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ForCompaniesPage;
