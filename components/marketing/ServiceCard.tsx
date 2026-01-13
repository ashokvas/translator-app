'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  pricing: string;
  features: string[];
  badge?: string;
  ctaText: string;
  ctaLink: string;
  highlighted?: boolean;
  onClick?: () => void;
}

export function ServiceCard({
  icon,
  title,
  description,
  pricing,
  features,
  badge,
  ctaText,
  ctaLink,
  highlighted = false,
  onClick,
}: ServiceCardProps) {
  return (
    <Card
      className={`relative hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
        highlighted ? 'border-2 border-primary' : ''
      }`}
      onClick={onClick}
    >
      {badge && (
        <Badge className="absolute top-4 right-4">
          {badge}
        </Badge>
      )}
      <CardHeader>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          {icon}
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <p className="text-3xl font-bold text-primary">{pricing}</p>
        </div>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Link href={ctaLink} className="w-full" onClick={(e) => e.stopPropagation()}>
          <Button className="w-full" size="lg" variant={highlighted ? 'default' : 'outline'}>
            {ctaText}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
