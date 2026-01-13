import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Don't check auth here - let individual pages handle redirects
  // This prevents issues with sign-in/sign-up pages
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
