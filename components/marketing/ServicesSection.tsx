'use client';

import { useState } from 'react';
import { ServiceCard } from './ServiceCard';

export function ServicesSection() {
  const [selectedService, setSelectedService] = useState<'certified' | 'general' | 'custom'>('general');

  const services = [
    {
      id: 'certified' as const,
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Certified Translation',
      description: 'Professional translation with certification, proofreading, and formatting',
      pricing: 'Starting at $25/page',
      features: [
        'Certification included',
        'Professional proofreading',
        'Format preservation',
        'Digital delivery',
        'Express service available',
        'USCIS/Government acceptance guaranteed',
      ],
      badge: 'Most Official',
      ctaText: 'Learn More',
      ctaLink: '/services/certified',
    },
    {
      id: 'general' as const,
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'General Translation',
      description: 'Quick, accurate translations for everyday needs',
      pricing: 'Starting at $15/page',
      features: [
        'Fast turnaround',
        'Accurate translation',
        'Digital delivery',
        'Cost-effective solution',
      ],
      badge: 'Most Popular',
      ctaText: 'Learn More',
      ctaLink: '/services/general',
    },
    {
      id: 'custom' as const,
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Custom Translation',
      description: 'Large-volume projects over 100 pages',
      pricing: 'Custom Pricing',
      features: [
        'Dedicated project manager',
        'Volume discounts',
        'Flexible timelines',
        'Specialized terminology management',
      ],
      badge: 'Best Value',
      ctaText: 'Request Custom Quote',
      ctaLink: '/services/custom',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Choose Your Translation Service
          </h2>
          <p className="text-xl text-muted-foreground">Professional translations tailored to your needs</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              icon={service.icon}
              title={service.title}
              description={service.description}
              pricing={service.pricing}
              features={service.features}
              badge={service.badge}
              ctaText={service.ctaText}
              ctaLink={service.ctaLink}
              highlighted={selectedService === service.id}
              onClick={() => setSelectedService(service.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
