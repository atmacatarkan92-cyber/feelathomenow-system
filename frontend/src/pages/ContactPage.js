import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Mail, Phone, MapPin, Clock, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { API_BASE_URL } from '../config';

const ContactPage = () => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
  const params = new URLSearchParams(location.search);
  const city = params.get('city');

  if (city) {
    setFormData((prev) => ({
      ...prev,
      message:
        language === 'de'
          ? `Ich interessiere mich für eine Wohnung in ${city}.`
          : `I am interested in an apartment in ${city}.`,
    }));
  }
}, [location.search, language]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          language: language,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || t.contact.successMessage);
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          message: '',
        });
      } else {
        throw new Error(result.message || 'Failed to submit');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(
        language === 'de'
          ? 'Fehler beim Senden. Bitte versuchen Sie es erneut.'
          : 'Error submitting. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      value: 'info@feelathomenow.ch',
      link: 'mailto:info@feelathomenow.ch',
    },
    {
      icon: Phone,
      title: language === 'de' ? 'Telefon' : 'Phone',
      value: '+41 58 510 22 89',
      link: 'tel:+41585102289',
    },
    {
      icon: MapPin,
      title: language === 'de' ? 'Hauptsitz' : 'Headquarters',
      value: 'Gerlafingen, Solothurn, Schweiz',
      link: 'https://maps.google.com/?q=Gerlafingen,Solothurn,Schweiz',
    },
    {
      icon: Clock,
      title: language === 'de' ? 'Öffnungszeiten' : 'Opening Hours',
      value: language === 'de' ? 'Mo-Fr: 9:00-18:00' : 'Mon-Fri: 9:00-17:00',
      link: null,
    },
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {t.contact.title}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t.contact.subtitle}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Contact Form */}
            <Card className="border-gray-100 shadow-xl">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      {t.contact.namePlaceholder}
                    </label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={t.contact.namePlaceholder}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      {t.contact.emailPlaceholder}
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t.contact.emailPlaceholder}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      {t.contact.phonePlaceholder}
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder={t.contact.phonePlaceholder}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                      {t.contact.companyPlaceholder}
                    </label>
                    <Input
                      id="company"
                      name="company"
                      type="text"
                      value={formData.company}
                      onChange={handleChange}
                      placeholder={t.contact.companyPlaceholder}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      {t.contact.messagePlaceholder}
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      placeholder={t.contact.messagePlaceholder}
                      rows={5}
                      className="w-full"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white py-6 text-lg font-semibold disabled:opacity-70"
                    data-testid="contact-submit-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span>{language === 'de' ? 'Wird gesendet...' : 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        {t.contact.submit}
                        <Send className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {language === 'de' ? 'Kontaktinformationen' : 'Contact Information'}
                </h2>
                <div className="space-y-6">
                  {contactInfo.map((info, index) => (
                    <Card key={index} className="border-gray-100 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="w-12 h-12 bg-[#FF7A3D]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <info.icon className="h-6 w-6 text-[#FF7A3D]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {info.title}
                            </h3>
                            {info.link ? (
                              <a 
                                href={info.link}
                                className="text-gray-600 hover:text-[#FF7A3D] transition-colors"
                              >
                                {info.value}
                              </a>
                            ) : (
                              <p className="text-gray-600">{info.value}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Map Image */}
              <Card className="border-gray-100 overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src="https://images.unsplash.com/photo-1620563092215-0fbc6b55cfc5?auto=format&fit=crop&w=1200&q=80"
                    alt="Zurich location"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-64 object-cover"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Cities Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {language === 'de' ? 'Wir sind in diesen Städten aktiv' : 'We Operate in These Cities'}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { name: 'Zürich', image: 'https://images.unsplash.com/photo-1620563092215-0fbc6b55cfc5?auto=format&fit=crop&w=900&q=75' },
              { name: 'Genf', image: 'https://images.unsplash.com/photo-1573137785546-9d19e4f33f87?auto=format&fit=crop&w=900&q=75' },
              { name: 'Basel', image: 'https://images.unsplash.com/photo-1643981670720-eef07ebdb179?auto=format&fit=crop&w=900&q=75' },
              { name: 'Zug', image: 'https://images.unsplash.com/photo-1649790247335-42156c080db6?auto=format&fit=crop&w=900&q=75' },
            ].map((city, index) => (
              <Card key={index} className="overflow-hidden border-gray-100 hover:shadow-xl transition-all duration-300 group">
                <CardContent className="p-0">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={city.image}
                      alt={city.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-2xl font-bold text-white">{city.name}</h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
