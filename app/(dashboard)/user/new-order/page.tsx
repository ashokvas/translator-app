import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';

export default async function NewOrderPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Choose Translation Service</h1>
          <p className="mt-2 text-muted-foreground">
            Select the service that best fits your translation needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Certified Translation */}
          <Link
            href="/user/new-order/certified"
            className="group bg-card text-card-foreground rounded-lg border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary p-6"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Certified Translation</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Professional translation with certification, proofreading, and formatting. USCIS/Government accepted.
            </p>
            <div className="flex items-center text-primary font-medium text-sm">
              Get Started
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* General Translation */}
          <Link
            href="/user/new-order/general"
            className="group relative bg-card text-card-foreground rounded-lg border-2 border-primary shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-6 overflow-visible"
          >
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded z-10">
              Most Popular
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">General Translation</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Quick, accurate translations for everyday needs. Perfect for business documents, personal letters, and more.
            </p>
            <div className="flex items-center text-primary font-medium text-sm">
              Get Started
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Custom Translation */}
          <Link
            href="/user/new-order/custom"
            className="group bg-card text-card-foreground rounded-lg border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary p-6"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Custom Translation</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Large-volume projects (100+ pages) with dedicated support. Get a custom quote tailored to your needs.
            </p>
            <div className="flex items-center text-primary font-medium text-sm">
              Request Quote
              <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-muted/40 border border-border rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-2">Need help choosing?</h3>
          <p className="text-sm text-muted-foreground">
            <strong>Certified:</strong> For official documents that require certification (birth certificates, diplomas, legal documents).<br />
            <strong>General:</strong> For everyday translations without certification (emails, letters, business documents).<br />
            <strong>Custom:</strong> For large projects or specialized requirements (100+ pages, technical manuals, books).
          </p>
        </div>
      </div>
    </div>
  );
}

