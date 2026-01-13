import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { ServiceOrderForm } from '@/components/orders/service-order-form';
import Link from 'next/link';

export default async function GeneralOrderPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/user/new-order"
            className="text-sm text-primary hover:opacity-90 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Service Selection
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">General Translation Order</h1>
          <p className="mt-2 text-muted-foreground">
            Quick, accurate translations for everyday needs
          </p>
        </div>
        <ServiceOrderForm
          serviceType="general"
          serviceName="General Translation"
          serviceDescription="Fast and accurate translation for non-official documents. Perfect for business documents, personal letters, marketing materials, and everyday translation needs."
        />
      </div>
    </div>
  );
}
