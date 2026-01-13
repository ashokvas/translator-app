import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CustomServicePage() {
  const features = [
    'Dedicated project manager',
    'Volume discounts',
    'Flexible timelines',
    'Specialized terminology management',
  ];

  const industries = [
    'Healthcare and Medical',
    'Legal and Compliance',
    'Technology and Software',
    'Financial Services',
    'Engineering and Manufacturing',
    'Education and Academic',
    'E-commerce and Retail',
    'Marketing and Advertising',
  ];

  const process = [
    { title: 'Consultation', desc: 'Discuss your specific requirements' },
    { title: 'Proposal', desc: 'Receive detailed quote and timeline' },
    { title: 'Assignment', desc: 'Dedicated team and project manager assigned' },
    { title: 'Execution', desc: 'Professional translation with ongoing updates' },
    { title: 'Review', desc: 'Quality assurance and client feedback' },
    { title: 'Delivery', desc: 'Final delivery in your preferred format' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="bg-background py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-fade-up">
            <div className="inline-block p-3 bg-primary/10 rounded-full mb-6">
              <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Custom Translation Solutions</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Large-volume projects over 100 pages with dedicated support
            </p>
            <div className="inline-flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-bold text-primary">Custom</span>
              <span className="text-xl text-muted-foreground">Pricing</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/user/new-order/custom">
                <Button size="lg">Request Custom Quote</Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  Schedule Consultation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Enterprise-Grade Translation Services
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Dedicated Project Manager', desc: 'Single point of contact for your entire project' },
              { title: 'Volume Discounts', desc: 'Competitive pricing for large projects (100+ pages)' },
              { title: 'Flexible Timelines', desc: 'Work with your schedule and deadlines' },
              { title: 'Specialized Terminology', desc: 'Custom glossaries and translation memory' },
            ].map((feature, index) => (
              <Card key={index} className="border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="pt-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industries & Process */}
      <section className="py-16 bg-muted/20 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Industries We Serve</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Our custom translation service is designed for organizations with complex, large-scale translation
                needs across various industries.
              </p>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {industries.map((industry, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-muted-foreground">{industry}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Our Process</h2>
              <div className="space-y-4">
                {process.map((step, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                      <p className="text-muted-foreground text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Discuss Your Project?</h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Get a custom quote within 24 hours tailored to your specific requirements
          </p>
          <Link href="/user/new-order/custom">
            <Button size="lg" variant="outline" className="bg-background text-foreground hover:bg-muted border-primary-foreground/20">
              Request Custom Quote
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
