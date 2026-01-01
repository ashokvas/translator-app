'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { format } from 'date-fns';
import { getLanguageName } from '@/lib/languages';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow p-6 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order not found</h1>
          <p className="text-gray-600 mb-6">This order does not exist or you don’t have access.</p>
          <Link href="/user/orders" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const isPaymentRequired = order.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order {order.orderNumber}</h1>
            <p className="mt-1 text-gray-600">
              Created {format(new Date(order.createdAt), 'MMM d, yyyy')} •{' '}
              {getLanguageName(order.sourceLanguage)} → {getLanguageName(order.targetLanguage)}
            </p>
          </div>
          <Link href="/user/orders" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Back
          </Link>
        </div>

        {isPaymentRequired && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-900">
              <strong>Payment required:</strong> Please complete payment to begin processing your translation.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase">Pages</div>
              <div className="text-lg font-semibold text-gray-900">{order.totalPages}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Amount</div>
              <div className="text-lg font-semibold text-gray-900">${order.amount.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Status</div>
              <div className="text-lg font-semibold text-gray-900">
                {order.status === 'pending' ? 'payment required' : order.status}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Uploaded Files</h2>
          <div className="space-y-3">
            {order.files.map((file: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">{file.fileName}</div>
                  <div className="text-xs text-gray-500">
                    {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} • {file.fileType}
                  </div>
                </div>
                {file.fileUrl ? (
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">No link</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isPaymentRequired && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Pay Now</h2>
            <PayPalButton amount={order.amount} orderId={order._id as any} onSuccess={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}


