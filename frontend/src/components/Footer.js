import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Mail, Phone, Instagram, Linkedin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  const quickLinks = [
    { name: t.nav.home, href: '/' },
    { name: t.nav.apartments, href: '/apartments' },
    { name: t.nav.about, href: '/about' },
    { name: t.nav.contact, href: '/contact' },
  ];

  const services = [
    { name: t.services.service1Title, href: '/apartments' },
    { name: t.services.service2Title, href: '/apartments' },
    { name: t.nav.forCompanies, href: '/for-companies' },
    { name: t.nav.forPropertyManagers, href: '/for-property-managers' },
  ];

  const locations = [
    { name: 'Zürich', href: '/wohnungen/zuerich' },
    { name: 'Basel', href: '/wohnungen/basel' },
    { name: 'Bern', href: '/wohnungen/bern' },
    { name: 'Genf', href: '/wohnungen/genf' },
  ];

  return (
    <footer className="bg-gradient-to-b from-gray-50 to-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <img 
              src="https://customer-assets.emergentagent.com/job_78f75558-dc34-4b54-943d-5ff2e8b80917/artifacts/3ua7ame3_Firma%20Logo%20geschnitten%20%281%29.png" 
              alt="FeelAtHomeNow" 
              className="h-10 w-auto"
            />
            <p className="text-sm text-gray-600 leading-relaxed">
              {t.footer.tagline}
            </p>
            <p className="text-sm text-gray-500">
              Hauptsitz: Gerlafingen (SO), Schweiz
            </p>
            
            <div className="flex space-x-4">
             
              <a 
                href="https://www.instagram.com/feelathomenow"
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#FF7A3D] transition-colors duration-200"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a 
                href="https://www.linkedin.com/in/feelathomenow-656897389" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#FF7A3D] transition-colors duration-200"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              {t.footer.quickLinks}
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-sm text-gray-600 hover:text-[#FF7A3D] transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              {t.footer.services}
            </h3>
            <ul className="space-y-3">
              {services.map((service) => (
                <li key={service.name}>
                  <Link
                    to={service.href}
                    className="text-sm text-gray-600 hover:text-[#FF7A3D] transition-colors duration-200"
                  >
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Locations & Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Tätig in
            </h3>
            <ul className="space-y-3 mb-6">
              {locations.map((location) => (
                <li key={location.name}>
                  <Link
                    to={location.href}
                    className="text-sm text-gray-600 hover:text-[#FF7A3D] transition-colors duration-200 flex items-center"
                  >
                    <MapPin className="h-3.5 w-3.5 mr-2" />
                    {location.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <a 
                href="mailto:info@feelathomenow.ch" 
                className="text-sm text-gray-600 hover:text-[#FF7A3D] transition-colors duration-200 flex items-center"
              >
                <Mail className="h-3.5 w-3.5 mr-2" />
                info@feelathomenow.ch
              </a>
            <a
              href="tel:+41585102289"
              className="text-sm text-gray-600 hover:text-[#FF7A3D] transition-colors duration-200 flex items-center"
            >
              <Phone className="h-3.5 w-3.5 mr-2" />
              +41 58 510 22 89
            </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            © {new Date().getFullYear()} FeelAtHomeNow. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
