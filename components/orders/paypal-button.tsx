'use client';

import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { Id } from '@/convex/_generated/dataModel';

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  storageId?: string;
  fileSize: number;
  pageCount: number;
  fileType: string;
}

interface PayPalButtonProps {
  amount: number;
  orderId: string; // Temporary ID or "pending"
  onSuccess: (paymentId: string) => void;
  files?: UploadedFile[]; // Order files (for creating order after payment)
  sourceLanguage?: string;
  targetLanguage?: string;
  totalPages?: number;
}

export function PayPalButton({ 
  amount, 
  orderId, 
  onSuccess, 
  files, 
  sourceLanguage, 
  targetLanguage, 
  totalPages 
}: PayPalButtonProps) {
  const { user } = useUser();
  const updateOrderPayment = useMutation(api.orders.updateOrderPayment);
  const createOrder = useMutation(api.orders.createOrder);

  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

  if (!paypalClientId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          PayPal is not configured. Please set NEXT_PUBLIC_PAYPAL_CLIENT_ID in your environment variables.
        </p>
      </div>
    );
  }

  const createPayPalOrder = async () => {
    try {
      // Create PayPal order
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount.toFixed(2),
          orderId,
        }),
      });

      const data = await response.json();
      return data.orderId;
    } catch (error) {
      console.error('Error creating PayPal order:', error);
      throw error;
    }
  };

  const onApprove = async (data: { orderID: string }) => {
    try {
      if (!user?.id) {
        alert('Please sign in to complete payment');
        return;
      }

      // Capture the payment
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderID: data.orderID,
          orderId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        let finalOrderId = orderId;

        // If orderId is "pending", create the order now (after payment success)
        if (orderId === 'pending' && files && sourceLanguage && targetLanguage && totalPages) {
          // Convert files to match the expected format
          const filesForOrder = files.map((file) => ({
            fileName: file.fileName,
            fileUrl: file.fileUrl,
            storageId: file.storageId ? (file.storageId as any as Id<'_storage'>) : undefined,
            fileSize: file.fileSize,
            pageCount: file.pageCount,
            fileType: file.fileType,
          }));

          // Create order AFTER payment is successful
          const orderResult = await createOrder({
            clerkId: user.id,
            files: filesForOrder,
            totalPages,
            amount,
            sourceLanguage,
            targetLanguage,
          });

          finalOrderId = orderResult.orderId;

          // Update order with payment info
          await updateOrderPayment({
            orderId: orderResult.orderId as any,
            paymentId: data.orderID,
            paymentStatus: result.status || 'completed',
          });
        } else if (orderId !== 'pending') {
          // Order already exists, just update payment status
          await updateOrderPayment({
            orderId: orderId as any,
            paymentId: data.orderID,
            paymentStatus: result.status || 'completed',
          });
        }

        // Send confirmation email (via API route)
        await fetch('/api/send-order-confirmation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: finalOrderId,
            email: user.emailAddresses[0]?.emailAddress,
          }),
        });

        onSuccess(data.orderID);
      } else {
        alert('Payment capture failed. Please contact support.');
      }
    } catch (error) {
      console.error('Error capturing payment:', error);
      alert('Payment processing failed. Please contact support.');
    }
  };

  return (
    <PayPalScriptProvider options={{ clientId: paypalClientId }}>
      <PayPalButtons
        createOrder={createPayPalOrder}
        onApprove={onApprove}
        style={{
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
        }}
      />
    </PayPalScriptProvider>
  );
}

