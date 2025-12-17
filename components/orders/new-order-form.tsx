'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FileUpload } from './file-upload';
import { PayPalButton } from './paypal-button';
import { AUTO_DETECT_LANGUAGE, LANGUAGES, getLanguageLabel, getLanguageName } from '@/lib/languages';
import { Id } from '@/convex/_generated/dataModel';
import { Select, SelectItem } from '@/components/ui/select';

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  storageId?: string; // Convex storage ID (optional for backward compatibility)
  fileSize: number;
  pageCount: number;
  fileType: string;
}

const PRICE_PER_PAGE = 35;

export function NewOrderForm() {
  const { user } = useUser();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string>(AUTO_DETECT_LANGUAGE.code);
  const [targetLanguage, setTargetLanguage] = useState<string>('es');
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

  const createOrder = useMutation(api.orders.createOrder);

  const totalPages = uploadedFiles.reduce((sum, file) => sum + file.pageCount, 0);
  const totalAmount = totalPages * PRICE_PER_PAGE;

  const handlePaymentSuccess = async (paymentId: string) => {
    setIsProcessing(true);
    // Small delay to show processing state
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = createdOrder ? `/user/orders/${createdOrder.orderId}` : '/user/orders';
      }
    }, 1000);
  };

  const handleCreateOrder = async () => {
    if (!user?.id) {
      alert('Please sign in to create an order');
      return;
    }

    if (uploadedFiles.length === 0) {
      alert('Please upload at least one file');
      return;
    }

    if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) {
      alert('Please select two different languages');
      return;
    }

    setIsProcessing(true);
    try {
      const filesForOrder = uploadedFiles.map((file) => ({
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        storageId: file.storageId ? (file.storageId as any as Id<'_storage'>) : undefined,
        fileSize: file.fileSize,
        pageCount: file.pageCount,
        fileType: file.fileType,
      }));

      const result = await createOrder({
        clerkId: user.id,
        files: filesForOrder,
        totalPages,
        amount: totalAmount,
        sourceLanguage,
        targetLanguage,
      });

      setCreatedOrder({ orderId: result.orderId, orderNumber: result.orderNumber });

      // Notify user that payment is required (email stub for now)
      await fetch('/api/send-order-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'payment_required',
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: totalAmount,
          email: user.emailAddresses[0]?.emailAddress,
        }),
      });
    } catch (error) {
      console.error('Failed to create order:', error);
      alert(`Failed to create order: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Language Selection Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Translation Languages
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="source-language"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Source Language
            </label>
              <Select
              id="source-language"
                value={sourceLanguage}
                onValueChange={setSourceLanguage}
              >
                <SelectItem value={AUTO_DETECT_LANGUAGE.code}>
                  {getLanguageLabel(AUTO_DETECT_LANGUAGE.code)}
                </SelectItem>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {getLanguageLabel(lang.code)}
                  </SelectItem>
                ))}
              </Select>
          </div>
          <div>
            <label
              htmlFor="target-language"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Target Language
            </label>
              <Select
              id="target-language"
                value={targetLanguage}
                onValueChange={setTargetLanguage}
              >
              {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {getLanguageLabel(lang.code)}
                  </SelectItem>
              ))}
              </Select>
          </div>
        </div>
        {sourceLanguage && targetLanguage && (
          <p className="mt-3 text-sm text-gray-600">
            Translating from <strong>{getLanguageName(sourceLanguage)}</strong> to{' '}
            <strong>{getLanguageName(targetLanguage)}</strong>
          </p>
        )}
      </div>

      {/* File Upload Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Upload Documents
        </h2>
        <FileUpload
          uploadedFiles={uploadedFiles}
          onFilesUploaded={setUploadedFiles}
        />
      </div>

      {/* Order Summary */}
      {uploadedFiles.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Order Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Translation:</span>
              <span className="font-medium">
                {getLanguageName(sourceLanguage)} → {getLanguageName(targetLanguage)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Number of documents:</span>
              <span className="font-medium">{uploadedFiles.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total pages:</span>
              <span className="font-medium">{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Price per page:</span>
              <span className="font-medium">${PRICE_PER_PAGE}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600 mb-1">
                Calculation: {totalPages} page{totalPages !== 1 ? 's' : ''} × ${PRICE_PER_PAGE} = ${totalAmount.toFixed(2)}
              </div>
            </div>
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total Amount:</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Order (Pay later) */}
      {uploadedFiles.length > 0 && !isProcessing && !createdOrder && (
        <div className="border-t pt-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-4">
              Create your order now and pay later. We will start processing after payment is completed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateOrder}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={sourceLanguage === targetLanguage}
          >
            Create Order (Pay Later)
          </button>
        </div>
      )}

      {/* Pay now (optional) after order exists */}
      {createdOrder && !isProcessing && (
        <div className="border-t pt-6 space-y-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-900">
              <strong>Order created:</strong> {createdOrder.orderNumber}. Payment is required before we start processing.
              You can pay now below or later from your Orders page.
            </p>
          </div>

          <a
            href={`/user/orders/${createdOrder.orderId}`}
            className="block w-full text-center bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            View Order
          </a>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pay Now (optional)</h3>
            <PayPalButton amount={totalAmount} orderId={createdOrder.orderId} onSuccess={handlePaymentSuccess} />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border-t pt-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing your order...</p>
          </div>
        </div>
      )}
    </div>
  );
}

