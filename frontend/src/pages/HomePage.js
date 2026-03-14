import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Home, Building2, Users, Briefcase, CheckCircle, Quote } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { mockTestimonials } from '../utils/mockData';

const HomePage = () => {
  const { t, language } = useLanguage();
  const observerRef = useRef(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.fade-on-scroll').forEach((el) => {
      observerRef.current.observe(el);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.pexels.com/photos/15031994/pexels-photo-15031994.jpeg"
            alt="Modern apartment"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/70 to-gray-900/50" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            {t.hero.headline}
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-10 max-w-3xl mx-auto leading-relaxed">
            {t.hero.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/apartments">
              <Button 
                size="lg" 
                className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-8 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {t.hero.cta1}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/for-companies">
              <Button 
                size="lg" 
                variant="outline"
                className="bg-white/10 backdrop-blur-sm border-2 border-white text-white hover:bg-white hover:text-gray-900 px-8 py-6 text-lg font-semibold rounded-lg transition-all duration-300 transform hover:-translate-y-1"
              >
                {t.hero.cta2}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-white fade-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t.services.title}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t.services.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Home, title: t.services.service1Title, desc: t.services.service1Desc },
              { icon: Users, title: t.services.service2Title, desc: t.services.service2Desc },
              { icon: Building2, title: t.services.service3Title, desc: t.services.service3Desc },
              { icon: Briefcase, title: t.services.service4Title, desc: t.services.service4Desc },
            ].map((service, index) => (
              <Card 
                key={index} 
                className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-gray-100 overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 bg-[#FF7A3D]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#FF7A3D] transition-colors duration-300">
                    <service.icon className="h-7 w-7 text-[#FF7A3D] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {service.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits for Companies Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white fade-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                {t.companies.title}
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                {t.companies.subtitle}
              </p>
              <div className="space-y-4">
                {[
                  { title: t.companies.benefit1Title, desc: t.companies.benefit1Desc },
                  { title: t.companies.benefit2Title, desc: t.companies.benefit2Desc },
                  { title: t.companies.benefit3Title, desc: t.companies.benefit3Desc },
                  { title: t.companies.benefit4Title, desc: t.companies.benefit4Desc },
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-[#FF7A3D] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">{benefit.title}</h4>
                      <p className="text-gray-600">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/for-companies">
                <Button 
                  className="mt-8 bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
                  size="lg"
                >
                  {t.companies.cta}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="relative">
              <img
                src="/apartment.png"
                alt="Business professionals"
                className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits for Property Managers Section */}
      <section className="py-20 bg-white fade-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative">
              <img
                src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg"
                alt="Property management"
                className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                {t.propertyManagers.title}
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                {t.propertyManagers.subtitle}
              </p>
              <div className="space-y-4">
                {[
                  { title: t.propertyManagers.benefit1Title, desc: t.propertyManagers.benefit1Desc },
                  { title: t.propertyManagers.benefit2Title, desc: t.propertyManagers.benefit2Desc },
                  { title: t.propertyManagers.benefit3Title, desc: t.propertyManagers.benefit3Desc },
                  { title: t.propertyManagers.benefit4Title, desc: t.propertyManagers.benefit4Desc },
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-[#FF7A3D] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-gray-900">{benefit.title}</h4>
                      <p className="text-gray-600">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/for-property-managers">
                <Button 
                  className="mt-8 bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
                  size="lg"
                >
                  {t.propertyManagers.cta}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white fade-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'de' ? 'Was unsere Kunden sagen' : 'What Our Clients Say'}
            </h2>
            
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {mockTestimonials.map((testimonial) => (
              <Card key={testimonial.id} className="border-gray-100 hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <Quote className="h-8 w-8 text-[#FF7A3D] mb-4" />
                  <p className="text-gray-700 mb-6 leading-relaxed italic">
                    "{testimonial.text[language]}"
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                      <img 
                        src={testimonial.image} 
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{testimonial.name}</p>
                      <p className="text-sm text-gray-600">{testimonial.role[language]}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#2C3E50] to-[#34495E] fade-on-scroll">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {language === 'de' ? 'Bereit, Ihr Zuhause in der Schweiz zu finden?' : 'Ready to Find Your Home in Switzerland?'}
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            {language === 'de'
              ? 'Kontaktieren Sie uns noch heute und lassen Sie uns die perfekte Wohnung für Sie finden.'
              : 'Contact us today and let us find the perfect apartment for you.'}
          </p>
          <Link to="/contact">
            <Button 
              size="lg"
              className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-10 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              {t.nav.contact}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
