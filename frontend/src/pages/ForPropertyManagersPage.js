import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Shield, TrendingUp, Home, CheckCircle2, ArrowRight } from 'lucide-react';

const ForPropertyManagersPage = () => {
  const { t, language } = useLanguage();

  const benefits = [
    {
      icon: Shield,
      title: t.propertyManagersPage.benefit1Title,
      desc: t.propertyManagersPage.benefit1Desc,
    },
    {
      icon: TrendingUp,
      title: t.propertyManagersPage.benefit2Title,
      desc: t.propertyManagersPage.benefit2Desc,
    },
    {
      icon: Home,
      title: t.propertyManagersPage.benefit3Title,
      desc: t.propertyManagersPage.benefit3Desc,
    },
    {
      icon: CheckCircle2,
      title: t.propertyManagersPage.benefit4Title,
      desc: t.propertyManagersPage.benefit4Desc,
    },
  ];

  const partnershipFeatures = [
    language === 'de' ? 'Langfristige Mietverträge (1-5 Jahre)' : 'Long-term rental contracts (1-5 years)',
    language === 'de' ? 'Garantierte monatliche Mietzahlungen' : 'Guaranteed monthly rent payments',
    language === 'de' ? 'Professionelle Immobilienverwaltung' : 'Professional property management',
    language === 'de' ? 'Regelmässige Wartung und Pflege' : 'Regular maintenance and care',
    language === 'de' ? 'Geprüfte und zuverlässige Mieter' : 'Vetted and reliable tenants',
    language === 'de' ? 'Transparente Kommunikation' : 'Transparent communication',
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative">
              <img
                src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg"
                alt="Property partnership"
                className="rounded-2xl shadow-2xl w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
            </div>
            <div className="order-1 lg:order-2">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {t.propertyManagersPage.title}
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                {t.propertyManagersPage.subtitle}
              </p>
              <p className="text-lg text-gray-700 mb-8 leading-relaxed">
                {t.propertyManagersPage.heroText}
              </p>
              <Button 
                size="lg"
                className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white"
                onClick={() => window.location.href = '/contact'}
              >
                {t.propertyManagersPage.ctaButton}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t.propertyManagersPage.benefitsTitle}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card 
                key={index}
                className="border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[#FF7A3D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="h-8 w-8 text-[#FF7A3D]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {benefit.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership Features Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'de' ? 'Was wir bieten' : 'What We Offer'}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {partnershipFeatures.map((feature, index) => (
              <div key={index} className="flex items-start space-x-3 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <CheckCircle2 className="h-6 w-6 text-[#FF7A3D] flex-shrink-0 mt-1" />
                <p className="text-gray-700 text-lg">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'de' ? 'So funktioniert die Partnerschaft' : 'How the Partnership Works'}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: language === 'de' ? 'Erstkontakt' : 'Initial Contact',
                desc: language === 'de' 
                  ? 'Kontaktieren Sie uns und teilen Sie uns Details zu Ihrer Immobilie mit.'
                  : 'Contact us and share details about your property.',
              },
              {
                step: '02',
                title: language === 'de' ? 'Bewertung' : 'Assessment',
                desc: language === 'de'
                  ? 'Wir bewerten Ihre Immobilie und erstellen ein massgeschneidertes Angebot.'
                  : 'We assess your property and create a tailored offer.',
              },
              {
                step: '03',
                title: language === 'de' ? 'Partnerschaft' : 'Partnership',
                desc: language === 'de'
                  ? 'Nach Vertragsabschluss übernehmen wir die Verwaltung und Vermietung.'
                  : 'After signing the contract, we handle management and rental.',
              },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="text-6xl font-bold text-[#FF7A3D]/35 mb-4">
                  {item.step}
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#2C3E50] to-[#34495E]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            {t.propertyManagersPage.ctaTitle}
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            {t.propertyManagersPage.ctaText}
          </p>
          <Button 
            size="lg"
            className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-10 py-6 text-lg"
            onClick={() => window.location.href = '/contact'}
          >
            {t.propertyManagersPage.ctaButton}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ForPropertyManagersPage;
