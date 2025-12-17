import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { UserDashboard } from '@/components/dashboards/user-dashboard';

export default async function UserDashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  return <UserDashboard />;
}

