import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { SignedIn, UserButton } from '@clerk/nextjs';
import { HeaderNav } from '@/components/navigation/header-nav';
import { DashboardLayoutClient } from '@/components/layouts/dashboard-layout-client';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <header className="border-b border-border p-4 bg-background text-foreground">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Translator Axis</h1>
          <div className="flex items-center gap-4">
            <SignedIn>
              <HeaderNav />
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-65px)] bg-background text-foreground">
        <DashboardLayoutClient>{children}</DashboardLayoutClient>
      </main>
    </>
  );
}



