import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { AdminDashboard } from '@/components/dashboards/admin-dashboard';

export default async function AdminDashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return <AdminDashboard />;
}

