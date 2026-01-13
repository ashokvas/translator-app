import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ServicesSection } from '@/components/marketing/ServicesSection';
import { PricingTabs } from '@/components/marketing/PricingTabs';
import { UnicornBackground } from '@/components/marketing/UnicornBackground';

export default async function LandingPage() {
  const user = await currentUser();

  // If user is signed in, redirect to their dashboard
  if (user) {
    const publicMetadata = user.publicMetadata as { role?: string };
    const role = publicMetadata?.role || 'user';
    
    if (role === 'admin') {
      redirect('/admin');
    } else {
      redirect('/user');
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Hero Section - Full Viewport Height */}
      <section className="relative w-full h-screen pt-20 flex items-end overflow-hidden">
        {/* Background container for unicorn.studio interactive element */}
        <div 
          id="unicorn-background" 
          className="absolute inset-0 z-0"
          aria-hidden="true"
        >
          {/* Unicorn.studio interactive background - client component to avoid hydration issues */}
          <UnicornBackground />
        </div>
        {/* Hero Content - Aligned to bottom-left with spacing */}
        <div className="relative z-10 w-full pb-20 md:pb-28 lg:pb-36 px-8 md:px-14 lg:px-20 xl:px-24">
          <div className="max-w-5xl space-y-6">
            <Badge variant="outline" className="text-sm px-4 py-1.5 border-primary/50">
              🌍 Available in 100+ Languages
            </Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-foreground leading-tight">
              Professional Translation Services You Can{' '}
              <span className="text-primary">Trust</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Fast, accurate, and certified translations in over 100 languages. USCIS accepted. Available 24/7.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8 w-full sm:w-auto h-14 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Get Started Free
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto h-14">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <svg 
            className="w-6 h-6 text-muted-foreground" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
        </div>
      </section>

      {/* Services Section */}
      <ServicesSection />

      {/* Trust / Compliance Strip */}
      <section className="w-full bg-background py-10 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Trusted. Secure. Accepted.</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                Built for high-stakes translation work
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">USCIS accepted</Badge>
              <Badge variant="secondary">Encrypted files</Badge>
              <Badge variant="secondary">NDA available</Badge>
              <Badge variant="secondary">Certified translators</Badge>
              <Badge variant="secondary">Human review</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="text-sm">How it works</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              From upload to delivery in four simple steps
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              A clean workflow that keeps your documents secure and your timelines predictable.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                title: 'Upload',
                description: 'Drop your files (PDF, DOCX, images) and choose languages.',
              },
              {
                step: '02',
                title: 'Quote',
                description: 'Get transparent pricing based on pages and service level.',
              },
              {
                step: '03',
                title: 'Translate',
                description: 'Professional translation with optional certification and review.',
              },
              {
                step: '04',
                title: 'Deliver',
                description: 'Download your completed files—ready for submission or publishing.',
              },
            ].map((item) => (
              <Card
                key={item.step}
                className="border-border hover:border-primary/50 transition-colors"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      Step {item.step}
                    </Badge>
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <span className="text-sm font-semibold">{item.step}</span>
                    </div>
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industries / Use cases */}
      <section className="w-full bg-card py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="text-sm">Use cases</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Tailored for the documents you translate most
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Pick a category and get the right workflow, formatting, and terminology handling.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Immigration', desc: 'USCIS-ready certified translations and clear formatting.' },
              { title: 'Legal', desc: 'Contracts, affidavits, and court documents with precision.' },
              { title: 'Academic', desc: 'Transcripts, diplomas, and letters—clean and consistent.' },
              { title: 'Medical', desc: 'Clinical docs with careful terminology and confidentiality.' },
              { title: 'Business', desc: 'Marketing, proposals, and internal docs at scale.' },
              { title: 'Technical', desc: 'Manuals, specs, and engineering docs with accuracy.' },
            ].map((item) => (
              <Card
                key={item.title}
                className="border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <span className="text-sm font-semibold">{item.title.slice(0, 1)}</span>
                    </div>
                  </div>
                  <CardDescription className="text-base leading-relaxed">{item.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="w-full bg-background py-16 md:py-24 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="text-center mb-10 md:mb-14 space-y-4">
            <Badge variant="outline" className="text-sm">Pricing preview</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Clear pricing for every service level
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Compare what’s included. Visit the full pricing page for details and add-ons.
            </p>
          </div>

          <PricingTabs />
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <div className="text-center mb-10 md:mb-14 space-y-4">
            <Badge variant="outline" className="text-sm">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Answers to common questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Quick clarity on certification, turnaround, and privacy.
            </p>
          </div>

          <Card className="border-border">
            <CardContent className="pt-2">
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>Are certified translations USCIS accepted?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Yes—our certified translations are formatted for USCIS and common government requirements.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>How is pricing calculated?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Pricing is typically based on page count, service level (general vs certified), and optional rush delivery.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>How fast can you deliver?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Many orders are delivered quickly, and rush options are available depending on language pair and volume.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>Do you keep my documents confidential?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Yes—documents are handled securely. We can also provide an NDA for business and enterprise requests.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                  <AccordionTrigger>What file types do you support?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Common formats like PDF and DOCX are supported, as well as images. If you have a special format, contact us.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full bg-background py-16 md:py-24 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { number: '100+', label: 'Languages Supported', icon: '🌐' },
              { number: '10K+', label: 'Documents Translated', icon: '📄' },
              { number: '24/7', label: 'Customer Support', icon: '💬' },
              { number: '99.9%', label: 'Accuracy Rate', icon: '✓' },
            ].map((stat, index) => (
              <div key={index} className="text-center space-y-2">
                <div className="text-4xl mb-2">{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.number}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section with Cards */}
      <section className="w-full bg-card py-16 md:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="text-sm">Why Choose Us</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Translation Services Built for Excellence
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Trusted by thousands of customers worldwide for professional, accurate translations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              { 
                title: 'Professional Translators', 
                description: 'Native speakers with subject matter expertise and years of experience',
                icon: (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                  </svg>
                ),
                badge: 'Expert Team'
              },
              { 
                title: 'Fast Turnaround', 
                description: '24-hour rush service available for urgent needs with guaranteed delivery',
                icon: (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
                  </svg>
                ),
                badge: 'Quick Service'
              },
              { 
                title: 'Competitive Pricing', 
                description: 'Transparent pricing with no hidden fees. Volume discounts available',
                icon: (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"></path>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"></path>
                  </svg>
                ),
                badge: 'Best Value'
              },
              { 
                title: 'Quality Guarantee', 
                description: '100% satisfaction guarantee or your money back. No questions asked',
                icon: (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                  </svg>
                ),
                badge: 'Guaranteed'
              },
              { 
                title: '24/7 Support', 
                description: 'Customer support available around the clock via chat, email, and phone',
                icon: (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path>
                  </svg>
                ),
                badge: 'Always Available'
              },
              { 
                title: 'Secure & Confidential', 
                description: 'Your documents are handled with strict confidentiality and encryption',
                icon: (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                  </svg>
                ),
                badge: 'Secure'
              },
            ].map((feature, index) => (
              <Card 
                key={index} 
                className="relative overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <div className="text-primary">
                        {feature.icon}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="text-sm">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                name: 'Sarah Johnson',
                role: 'Immigration Attorney',
                content: 'Outstanding service! The certified translations were accepted by USCIS without any issues. Fast turnaround and professional quality.',
                rating: 5
              },
              {
                name: 'Michael Chen',
                role: 'Business Owner',
                content: 'We use their services for all our international contracts. The accuracy and attention to detail are exceptional.',
                rating: 5
              },
              {
                name: 'Maria Garcia',
                role: 'Student',
                content: 'Needed my diploma translated urgently. They delivered in 24 hours with perfect accuracy. Highly recommend!',
                rating: 5
              },
            ].map((testimonial, index) => (
              <Card key={index} className="border-border">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                        {testimonial.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{testimonial.name}</CardTitle>
                      <CardDescription className="text-sm">{testimonial.role}</CardDescription>
                    </div>
                  </div>
                  <div className="flex text-primary mb-3">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">"{testimonial.content}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full bg-primary py-16 md:py-24 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="relative max-w-4xl mx-auto px-6 md:px-12 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Join thousands of satisfied customers worldwide and experience professional translation services today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/sign-up">
              <Button size="lg" variant="secondary" className="text-lg px-8 h-14 shadow-lg">
                Create Free Account
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
