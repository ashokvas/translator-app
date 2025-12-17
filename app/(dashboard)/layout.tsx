import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
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

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}

