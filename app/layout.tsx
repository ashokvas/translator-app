import type { Metadata } from 'next';
import {
  ClerkProvider,
} from '@clerk/nextjs';
import { ConvexClientProvider } from '@/components/providers/convex-provider';
import { UserSync } from '@/components/auth/user-sync';
import './globals.css';

export const metadata: Metadata = {
  title: 'Translator App',
  description: 'Translation application with Next.js, Clerk, and Convex',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body suppressHydrationWarning>
          <ConvexClientProvider>
            <UserSync />
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

