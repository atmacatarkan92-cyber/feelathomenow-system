import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { Target, Eye, Award, Users, Heart, Shield, TrendingUp } from 'lucide-react';

const AboutPage = () => {
  const { t, language } = useLanguage();

  const values = [
    {
      icon: Award,
      title: t.aboutPage.value1,
      desc: t.aboutPage.value1Desc,
    },
    {
      icon: Users,
      title: t.aboutPage.value2,
      desc: t.aboutPage.value2Desc,
    },
    {
      icon: Heart,
      title: t.aboutPage.value3,
      desc: t.aboutPage.value3Desc,
    },
    {
      icon: Shield,
      title: t.aboutPage.value4,
      desc: t.aboutPage.value4Desc,
    },
  ];

  const stats = [
    { number: '140+', label: language === 'de' ? 'Zufriedene Kunden' : 'Happy Clients' },
    { number: '15+', label: language === 'de' ? 'Apartments' : 'Apartments' },
    { number: '4', label: language === 'de' ? 'Städte' : 'Cities' },
    { number: '93%', label: language === 'de' ? 'Kundenzufriedenheit' : 'Client Satisfaction' },
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t.aboutPage.title}
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              {t.aboutPage.subtitle}
            </p>
          </div>

          {/* Hero Image */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-16">
            <img
              src="https://images.unsplash.com/photo-1620563092215-0fbc6b55cfc5"
              alt="Zurich cityscape"
              className="w-full h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[#FF7A3D] mb-2">
             {stat.number}
          </div>
                <div className="text-gray-600 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Mission */}
            <Card className="border-gray-100 shadow-lg">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-[#FF7A3D]/10 rounded-full flex items-center justify-center mb-6">
                  <Target className="h-8 w-8 text-[#FF7A3D]" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t.aboutPage.missionTitle}
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {t.aboutPage.missionText}
                </p>
              </CardContent>
            </Card>

            {/* Vision */}
            <Card className="border-gray-100 shadow-lg">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-[#FF7A3D]/10 rounded-full flex items-center justify-center mb-6">
                  <Eye className="h-8 w-8 text-[#FF7A3D]" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t.aboutPage.visionTitle}
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {t.aboutPage.visionText}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t.aboutPage.valuesTitle}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <Card 
                key={index}
                className="border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[#FF7A3D]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <value.icon className="h-8 w-8 text-[#FF7A3D]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {value.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'de' ? 'Unsere Geschichte' : 'Our Story'}
            </h2>
          </div>

          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-lg leading-relaxed mb-6">
              {language === 'de'
                ? 'FeelAtHomeNow entstand aus der Idee, internationalen Professionals, Expats und Studierenden den Start in der Schweiz einfacher zu machen. Gerade in Städten wie Zürich ist es oft schwierig, kurzfristig passenden Wohnraum zu finden. Genau hier setzen wir an – mit möblierten Apartments und flexiblen Co-Living Lösungen.'
                : 'FeelAtHomeNow was created with the idea of making it easier for international professionals, expats and students to settle in Switzerland. Especially in cities like Zurich, finding suitable housing on short notice can be challenging. This is exactly where we come in – with furnished apartments and flexible co-living solutions.'}
            </p>
            <p className="text-lg leading-relaxed mb-6">
              {language === 'de'
                ? 'Seit unserer Gründung haben wir über 140 Kunden dabei geholfen, sich in der Schweiz zuhause zu fühlen. Unsere Apartments befinden sich in den besten Lagen von Zürich, Genf, Basel und Zug – immer mit dem Fokus auf Qualität, Service und Flexibilität.'
                : 'Since our founding, we have helped over 140 clients feel at home in Switzerland. Our apartments are located in prime areas of Zurich, Geneva, Basel and Zug – always with a focus on quality, service and flexibility.'}
            </p>
            <p className="text-lg leading-relaxed">
              {language === 'de'
                ? 'Heute sind wir stolzer Partner von führenden internationalen Unternehmen und Immobilieneigentümern. Unser Ziel bleibt unverändert: Jedem das Gefühl zu geben, in der Schweiz wirklich zuhause zu sein.'
                : 'Today we are a proud partner of leading international companies and property owners. Our goal remains unchanged: to make everyone feel truly at home in Switzerland.'}
            </p>
          </div>
        </div>
      </section>

      {/* Image Gallery */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              'https://images.unsplash.com/photo-1573137785546-9d19e4f33f87',
              'https://images.unsplash.com/photo-1643981670720-eef07ebdb179',
              'https://images.unsplash.com/photo-1649790247335-42156c080db6',
              'https://images.pexels.com/photos/15031992/pexels-photo-15031992.jpeg',
            ].map((image, index) => (
              <div key={index} className="relative h-64 rounded-lg overflow-hidden shadow-lg group">
                <img
                  src={image}
                  alt={`Swiss location ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
