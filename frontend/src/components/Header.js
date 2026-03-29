import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import vantioLogo from '../assets/vantio-logo.svg';

/** Public marketing site → production app login (fixed URL, not SPA-relative). */
export const PUBLIC_APP_LOGIN_URL = 'https://vantio-system.vercel.app/admin/login';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Features', href: '/#features' },
    { name: 'Contact', href: '/contact' },
    { name: 'Login', href: PUBLIC_APP_LOGIN_URL, external: true },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' && !location.hash;
    }
    if (path === '/#features') {
      return location.pathname === '/' && location.hash === '#features';
    }
    return location.pathname === path;
  };

  const navLinkClass = (active) =>
    `text-sm font-medium transition-colors duration-200 relative group ${
      active ? 'text-[#FF7A3D]' : 'text-gray-700 hover:text-[#FF7A3D]'
    }`;

  const navUnderline = (active) =>
    `absolute -bottom-1 left-0 w-0 h-0.5 bg-[#FF7A3D] transition-all duration-200 group-hover:w-full ${
      active ? 'w-full' : ''
    }`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2 shrink-0 pr-4">
            <img src={vantioLogo} alt="Vantio" className="h-9 sm:h-10 w-auto" />
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {navigation.map((item) => {
              const active = item.external ? false : isActive(item.href);
              return item.external ? (
                <a
                  key={item.name}
                  href={item.href}
                  className={navLinkClass(active)}
                  rel="noopener noreferrer"
                >
                  {item.name}
                  <span className={navUnderline(active)} />
                </a>
              ) : (
                <Link key={item.name} to={item.href} className={navLinkClass(active)}>
                  {item.name}
                  <span className={navUnderline(active)} />
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="hidden sm:flex items-center space-x-2 text-gray-700 hover:text-[#FF7A3D] hover:bg-[#FF7A3D]/5"
            >
              <Globe className="h-4 w-4" />
              <span className="text-sm font-medium">{language.toUpperCase()}</span>
            </Button>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              type="button"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-3">
              {navigation.map((item) => {
                const active = item.external ? false : isActive(item.href);
                const mobileClass = `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  active ? 'text-[#FF7A3D] bg-[#FF7A3D]/10' : 'text-gray-700 hover:bg-gray-50'
                }`;
                return item.external ? (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={mobileClass}
                    rel="noopener noreferrer"
                  >
                    {item.name}
                  </a>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={mobileClass}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={toggleLanguage}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors sm:hidden"
              >
                <Globe className="h-4 w-4" />
                <span>{language === 'de' ? 'English' : 'Deutsch'}</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
