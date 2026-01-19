/**
 * PayPal payment button for an existing order.
 *
 * Notes:
 * - This component updates Convex via `api.orders.updateOrderPayment` after payment capture.
 * - If `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is missing, we render a simple fallback button so local dev can proceed.
 */
'use client';

import { useMemo, useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface PayPalButtonProps {
  amount: number;
  orderId: string;
  onSuccess?: (paymentId: string) => void;
}

export function PayPalButton({ amount, orderId, onSuccess }: PayPalButtonProps) {
  const updateOrderPayment = useMutation(api.orders.updateOrderPayment);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const paypalOptions = useMemo(() => {
    return {
      clientId: clientId || 'test', // PayPalScriptProvider requires a value; we gate rendering when missing.
      currency: 'USD',
      intent: 'CAPTURE',
    } as const;
  }, [clientId]);

  async function createServerSidePayPalOrder(): Promise<string> {
    // Server route should create a PayPal order and return its PayPal `orderId`.
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = (await res.json()) as { orderId?: string };
    if (!data.orderId) {
      throw new Error('PayPal create-order did not return an orderId');
    }

    return data.orderId;
  }

  async function captureServerSidePayPalOrder(paypalOrderId: string): Promise<{ status: string }> {
    // Server route should capture the PayPal order and return a status (e.g., COMPLETED).
    const res = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: paypalOrderId, orderId }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = (await res.json()) as { status?: string; success?: boolean };
    return { status: data.status || (data.success ? 'COMPLETED' : 'UNKNOWN') };
  }

  async function markOrderPaid(paypalOrderId: string, paymentStatus: string) {
    // Convex expects an `orders` document id; we receive it as a string from existing pages.
    await updateOrderPayment({
      orderId: orderId as any,
      paymentId: paypalOrderId,
      paymentStatus,
    });
  }

  async function handleFallbackPayNow() {
    // This path is for local/dev when PayPal client ID isn't configured.
    setErrorMessage(null);
    setIsPaying(true);
    try {
      const paypalOrderId = await createServerSidePayPalOrder();
      const { status } = await captureServerSidePayPalOrder(paypalOrderId);
      await markOrderPaid(paypalOrderId, status);
      onSuccess?.(paypalOrderId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {!clientId ? (
        <button
          type="button"
          onClick={handleFallbackPayNow}
          disabled={isPaying}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPaying ? 'Processing payment…' : `Pay $${amount.toFixed(2)} (PayPal)`}
        </button>
      ) : (
        <PayPalScriptProvider options={paypalOptions}>
          <PayPalButtons
            style={{ layout: 'vertical', label: 'paypal' }}
            disabled={isPaying}
            createOrder={async () => {
              setErrorMessage(null);
              setIsPaying(true);
              try {
                return await createServerSidePayPalOrder();
              } catch (err) {
                setErrorMessage(err instanceof Error ? err.message : String(err));
                throw err;
              } finally {
                setIsPaying(false);
              }
            }}
            onApprove={async (data) => {
              setErrorMessage(null);
              setIsPaying(true);
              try {
                const paypalOrderId = data.orderID;
                if (!paypalOrderId) {
                  throw new Error('PayPal approval missing orderID');
                }
                const { status } = await captureServerSidePayPalOrder(paypalOrderId);
                await markOrderPaid(paypalOrderId, status);
                onSuccess?.(paypalOrderId);
              } catch (err) {
                setErrorMessage(err instanceof Error ? err.message : String(err));
              } finally {
                setIsPaying(false);
              }
            }}
            onError={(err) => {
              setErrorMessage(err instanceof Error ? err.message : String(err));
            }}
          />
        </PayPalScriptProvider>
      )}
    </div>
  );
}

