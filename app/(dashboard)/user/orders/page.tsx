import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { UserOrders } from '@/components/orders/user-orders';

export default async function UserOrdersPage() {
  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return <UserOrders />;
}


