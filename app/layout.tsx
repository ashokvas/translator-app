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
      <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning>
          <ConvexClientProvider>
            <header className="border-b border-gray-200 p-4">
              <div className="container mx-auto flex items-center justify-between">
                <h1 className="text-xl font-bold">Translator App</h1>
                <div className="flex items-center gap-4">
                  <SignedOut>
                    <SignInButton mode="redirect" forceRedirectUrl="/sign-in">
                      <span className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer">
                        Sign In
                      </span>
                    </SignInButton>
                    <SignUpButton mode="redirect" forceRedirectUrl="/sign-up">
                      <span className="inline-block rounded border border-gray-300 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                        Sign Up
                      </span>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <HeaderNav />
                    <UserButton />
                  </SignedIn>
                </div>
              </div>
            </header>
            <UserSync />
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

