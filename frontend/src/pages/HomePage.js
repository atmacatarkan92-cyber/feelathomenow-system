import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Layers,
  BarChart3,
  Wallet,
  Users,
  Share2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

/**
 * Public landing copy (EN). Structure is ready to swap for i18n later.
 */
const LANDING = {
  hero: {
    headline: 'All-in-One Property Management Software for Modern Rental Businesses',
    subheadline:
      'Manage co-living, serviced apartments and rental portfolios in one platform — with real-time insights, automation and full control.',
    tagline: 'Built for operators. Not spreadsheets.',
    primaryCta: 'Request demo',
    secondaryCta: 'Login',
  },
  features: [
    {
      title: 'Portfolio Management',
      description: 'Centralize units, buildings and contracts in one operational view.',
      Icon: Layers,
    },
    {
      title: 'Flexible Rental Models',
      description: 'Co-living, serviced apartments and mixed portfolios — configured your way.',
      Icon: Building2,
    },
    {
      title: 'Real-Time Analytics',
      description: 'Live occupancy, revenue and performance metrics without manual exports.',
      Icon: BarChart3,
    },
    {
      title: 'Financial Overview',
      description: 'Invoices, payments and cash-flow visibility across your portfolio.',
      Icon: Wallet,
    },
    {
      title: 'Tenant Management',
      description: 'Onboarding, communication and lifecycle tools built for scale.',
      Icon: Users,
    },
    {
      title: 'Listings & Distribution',
      description: 'Publish and sync listings with consistent branding and control.',
      Icon: Share2,
    },
  ],
  problemSolution: {
    problem: 'Excel chaos, no overview, manual processes',
    solution: 'One platform, clear data, full control',
  },
  audience: {
    title: 'Who is Vantio for?',
    items: [
      'Property managers',
      'Co-living operators',
      'Serviced apartment providers',
      'Real estate investors',
    ],
  },
  finalCta: {
    headline: 'Ready to run your rental business in one system?',
    button: 'Request demo',
  },
};

const HomePage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* 1. Hero */}
      <section className="relative pt-28 pb-20 lg:pt-32 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-orange-50/40 pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            {LANDING.hero.headline}
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 mb-4 max-w-3xl mx-auto leading-relaxed">
            {LANDING.hero.subheadline}
          </p>
          <p className="text-sm font-medium text-slate-500 mb-10 uppercase tracking-wide">
            {LANDING.hero.tagline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/contact">
              <Button
                size="lg"
                className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-8 py-6 text-base font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
              >
                {LANDING.hero.primaryCta}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/admin/login">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-slate-200 text-slate-800 hover:bg-slate-50 px-8 py-6 text-base font-semibold rounded-lg"
              >
                {LANDING.hero.secondaryCta}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Features */}
      <section id="features" className="py-20 bg-white border-t border-slate-100 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">Features</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Everything you need to operate modern rental portfolios in one place.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LANDING.features.map(({ title, description, Icon }) => (
              <Card
                key={title}
                className="border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <CardContent className="p-6">
                  <div className="w-11 h-11 rounded-lg bg-[#FF7A3D]/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-[#FF7A3D]" strokeWidth={2} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Problem → Solution */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-stretch">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-3">
                The problem
              </p>
              <p className="text-xl md:text-2xl font-semibold leading-snug text-white/95">
                {LANDING.problemSolution.problem}
              </p>
            </div>
            <div className="rounded-2xl border border-[#FF7A3D]/40 bg-[#FF7A3D]/10 p-8 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-200 mb-3">
                The solution
              </p>
              <p className="text-xl md:text-2xl font-semibold leading-snug text-white">
                {LANDING.problemSolution.solution}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Target group */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-10">
            {LANDING.audience.title}
          </h2>
          <ul className="space-y-4 text-left max-w-md mx-auto">
            {LANDING.audience.items.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-slate-700 text-lg border-b border-slate-200/80 pb-4 last:border-0 last:pb-0"
              >
                <span className="flex h-2 w-2 rounded-full bg-[#FF7A3D] shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5. Final CTA */}
      <section className="py-20 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-8 leading-snug">
            {LANDING.finalCta.headline}
          </h2>
          <Link to="/contact">
            <Button
              size="lg"
              className="bg-[#FF7A3D] hover:bg-[#FF6A2D] text-white px-10 py-6 text-base font-semibold rounded-lg shadow-lg"
            >
              {LANDING.finalCta.button}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
