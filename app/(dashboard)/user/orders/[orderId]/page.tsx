import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { OrderDetails } from '@/components/orders/order-details';

export default async function UserOrderDetailsPage(props: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await currentUser();
  if (!user) {
    redirect('/sign-in');
  }

  const params = await props.params;

  return <OrderDetails orderId={params.orderId} />;
}


