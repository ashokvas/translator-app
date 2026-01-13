import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import { ConvexClientProvider } from '@/components/providers/convex-provider';
import { UserSync } from '@/components/auth/user-sync';
import { HeaderNav } from '@/components/navigation/header-nav';
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

