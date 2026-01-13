/**
 * Order Details Component
 * 
 * NOTE: Translation direction information has been removed from the order details page.
 * Translation information is still stored in the database and visible to admins, but
 * is not displayed to users.
 */
'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { format } from 'date-fns';
import { PayPalButton } from '@/components/orders/paypal-button';

export function OrderDetails({ orderId }: { orderId: string }) {
  const { user, isLoaded } = useUser();

  const order = useQuery(
    api.orders.getOrderById,
    user?.id ? { orderId: orderId as any, clerkId: user.id } : 'skip'
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (order === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading order...</div>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Order not found</h1>
          <p className="text-muted-foreground mb-6">This order does not exist or you don’t have access.</p>
          <Link href="/user/orders" className="text-primary hover:opacity-90 font-medium">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const isPaymentRequired = order.status === 'pending';
  const isQuotePending = order.status === 'quote_pending';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Order {order.orderNumber}</h1>
            <p className="mt-1 text-muted-foreground">
              Created {format(new Date(order.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
          <Link href="/user/orders" className="text-primary hover:opacity-90 font-medium">
            ← Back
          </Link>
        </div>

        {isQuotePending && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Quote pending:</strong> We're reviewing your custom translation request. You'll receive a quote via email within 24 hours.
            </p>
          </div>
        )}

        {isPaymentRequired && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Payment required:</strong> Please complete payment to begin processing your translation.
            </p>
          </div>
        )}

        <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase">Service</div>
              <div className="text-lg font-semibold text-foreground capitalize">
                {(order as any).serviceType ? (order as any).serviceType.charAt(0).toUpperCase() + (order as any).serviceType.slice(1) : 'General'}
                {(order as any).isRush === true && <span className="ml-2 text-sm text-orange-400">(Rush)</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Pages</div>
              <div className="text-lg font-semibold text-foreground">{order.totalPages}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Amount</div>
              <div className="text-lg font-semibold text-foreground">
                {isQuotePending ? 'Quote pending' : `$${order.amount.toFixed(2)}`}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Status</div>
              <div className="text-lg font-semibold text-foreground">
                {order.status === 'pending'
                  ? 'payment required'
                  : order.status === 'quote_pending'
                  ? 'quote pending'
                  : order.status}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
          <div className="space-y-3">
            {order.files.map((file: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-foreground">{file.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} • {file.fileType}
                  </div>
                </div>
                {file.fileUrl ? (
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:opacity-90 text-sm font-medium"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">No link</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isPaymentRequired && !isQuotePending && (
          <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Pay Now</h2>
            <PayPalButton amount={order.amount} orderId={order._id as any} onSuccess={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}


