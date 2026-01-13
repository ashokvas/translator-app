import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PricingPage() {
  const pricingPlans = [
    {
      title: 'Certified Translation',
      description: 'Professional translation with certification, proofreading, and formatting',
      pricing: { standard: 25, rush: 50 },
      features: [
        'Certification included',
        'Professional proofreading',
        'Format preservation',
        'Digital delivery',
        'Express service available',
        'USCIS/Government acceptance guaranteed',
      ],
      badge: 'Most Official',
      link: '/user/new-order/certified',
    },
    {
      title: 'General Translation',
      description: 'Quick, accurate translations for everyday needs',
      pricing: { standard: 15, rush: 30 },
      features: ['Fast turnaround', 'Accurate translation', 'Digital delivery', 'Cost-effective solution'],
      badge: 'Most Popular',
      highlighted: true,
      link: '/user/new-order/general',
    },
    {
      title: 'Custom Translation',
      description: 'Large-volume projects over 100 pages',
      pricing: null,
      features: [
        'Dedicated project manager',
        'Volume discounts',
        'Flexible timelines',
        'Specialized terminology management',
      ],
      badge: 'Best Value',
      link: '/user/new-order/custom',
    },
  ];

  const faqs = [
    {
      question: 'How is pricing calculated?',
      answer:
        'Pricing is based on the number of pages. A standard page is defined as 250 words or one physical page of a document.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, and PayPal for secure online payments.',
    },
    {
      question: 'Do you offer refunds?',
      answer:
        "Yes, we offer a 100% satisfaction guarantee. If you're not satisfied with the translation, we'll revise it for free or provide a full refund.",
    },
    {
      question: 'Are there any hidden fees?',
      answer: 'No, our pricing is completely transparent. The price you see is the price you pay, with optional add-ons clearly listed.',
    },
    {
      question: 'How does the rush service work?',
      answer: 'Rush service guarantees delivery within 24 hours. Simply select the rush option when placing your order.',
    },
    {
      question: 'Do you offer volume discounts?',
      answer:
        'Yes, volume discounts are available for orders over 50 pages (General Translation) or custom quotes for projects over 100 pages.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="bg-background py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-fade-up space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">Transparent Pricing</h1>
            <p className="text-xl text-muted-foreground">
              Choose the service that fits your needs. No hidden fees, no surprises.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 ${
                  plan.highlighted ? 'border-2 border-primary shadow-lg shadow-primary/10' : ''
                }`}
              >
                {plan.badge && (
                  <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">{plan.badge}</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.title}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {plan.pricing ? (
                    <div className="mb-6">
                      <div className="mb-2">
                        <span className="text-4xl font-bold text-primary">${plan.pricing.standard}</span>
                        <span className="text-muted-foreground">/page</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Standard delivery</p>
                      <div className="mt-2">
                        <span className="text-2xl font-bold text-foreground">${plan.pricing.rush}</span>
                        <span className="text-muted-foreground text-sm">/page (Rush)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="text-4xl font-bold text-primary mb-2">Custom</div>
                      <p className="text-sm text-muted-foreground">Based on project scope</p>
                    </div>
                  )}

                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href={plan.link} className="w-full">
                    <Button className="w-full" size="lg" variant={plan.highlighted ? 'default' : 'outline'}>
                      {plan.pricing ? 'Order Now' : 'Get Quote'}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-2">
              <strong>What counts as a page?</strong> Standard page = 250 words or one physical page
            </p>
            <p className="text-muted-foreground mb-2">
              <strong>Add-on services:</strong> Notarization (+$25), Apostille (+$75)
            </p>
            <p className="text-muted-foreground">
              <strong>Rush guarantee:</strong> 24-hour delivery or your money back
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/20 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <Card key={index} className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-indigo-100 mb-8">Choose your service and place your order today</p>
          <Link href="/sign-up">
            <Button
              size="lg"
              variant="outline"
              className="bg-background text-foreground hover:bg-muted border-primary-foreground/20"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
