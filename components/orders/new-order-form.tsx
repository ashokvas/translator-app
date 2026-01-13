/**
 * DEPRECATED: This component is no longer used.
 * 
 * Replaced by service-specific order forms:
 * - components/orders/service-order-form.tsx (unified form for all services)
 * - app/(dashboard)/user/new-order/certified/page.tsx
 * - app/(dashboard)/user/new-order/general/page.tsx
 * - app/(dashboard)/user/new-order/custom/page.tsx
 * 
 * Keeping this file for reference only.
 */

'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FileUpload } from './file-upload';
import { PayPalButton } from './paypal-button';
import { LANGUAGES, getLanguageLabel, getLanguageName } from '@/lib/languages';
import { Id } from '@/convex/_generated/dataModel';
import { Select, SelectItem } from '@/components/ui/select';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  storageId?: string; // Convex storage ID (optional for backward compatibility)
  fileSize: number;
  pageCount: number;
  fileType: string;
}

type OcrQuality = 'low' | 'high';

interface OcrQualityOption {
  value: OcrQuality;
  label: string;
  description: string;
  icon: string;
}

const OCR_QUALITY_OPTIONS: OcrQualityOption[] = [
  {
    value: 'high',
    label: 'High Quality',
    description: 'Best for scanned documents, photos of documents, or low-quality images. Applies image enhancement for better OCR accuracy.',
    icon: '✨',
  },
  {
    value: 'low',
    label: 'Standard Quality',
    description: 'Best for clear digital documents, high-resolution images, or when faster processing is preferred.',
    icon: '⚡',
  },
];

const PRICE_PER_PAGE = 35;

export function NewOrderForm() {
  const { user } = useUser();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  // Source language is always 'auto' (auto-detect) - not shown to user
  const sourceLanguage = 'auto';
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [ocrQuality, setOcrQuality] = useState<OcrQuality>('high');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
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
      setNotice({ title: 'Sign in required', message: 'Please sign in to create an order.' });
      return;
    }

    if (uploadedFiles.length === 0) {
      setNotice({ title: 'No files', message: 'Please upload at least one file.' });
      return;
    }

    if (!targetLanguage) {
      setNotice({ title: 'Invalid language', message: 'Please select a target language.' });
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
        serviceType: 'general',
        isRush: false,
        files: filesForOrder,
        totalPages,
        amount: totalAmount,
        sourceLanguage,
        targetLanguage,
        ocrQuality,
      });

      setCreatedOrder({ orderId: result.orderId, orderNumber: result.orderNumber });

      // Send order created email
      await fetch('/api/send-order-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'order_created',
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: totalAmount,
          totalPages,
          fileCount: uploadedFiles.length,
          sourceLanguage,
          targetLanguage,
          email: user.emailAddresses[0]?.emailAddress,
          customerName: user.fullName || user.firstName || undefined,
        }),
      });
    } catch (error) {
      console.error('Failed to create order:', error);
      setNotice({
        title: 'Create order failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6 space-y-6">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
      {/* Language Selection Section */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Translation Language
        </h2>
        <div>
          <label
            htmlFor="target-language"
            className="block text-sm font-medium text-foreground mb-2"
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
          <p className="mt-2 text-sm text-muted-foreground">
            Your documents will be translated to <strong>{getLanguageName(targetLanguage)}</strong>.
          </p>
        </div>
      </div>

      {/* File Upload Section */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Upload Documents
        </h2>
        <FileUpload
          uploadedFiles={uploadedFiles}
          onFilesUploaded={setUploadedFiles}
        />
      </div>

      {/* Document Quality Section */}
      {uploadedFiles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Document Quality
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select the quality of your uploaded documents. This helps us optimize text extraction for scanned or photographed documents.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OCR_QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setOcrQuality(option.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  ocrQuality === option.value
                    ? 'border-primary bg-muted/40 ring-2 ring-primary/30'
                    : 'border-border hover:border-border/70 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{option.icon}</span>
                  <span className={`font-semibold ${
                    ocrQuality === option.value ? 'text-foreground' : 'text-foreground'
                  }`}>
                    {option.label}
                  </span>
                  {ocrQuality === option.value && (
                    <span className="ml-auto">
                      <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className={`text-sm ${
                  ocrQuality === option.value ? 'text-muted-foreground' : 'text-muted-foreground'
                }`}>
                  {option.description}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 bg-muted/40 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>💡 Tip:</strong> If your documents are scanned, photographed, or have poor image quality, select &quot;High Quality&quot; for better text recognition accuracy.
            </p>
          </div>
        </div>
      )}

      {/* Order Summary */}
      {uploadedFiles.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Order Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Language:</span>
              <span className="font-medium text-foreground">
                {getLanguageName(targetLanguage)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number of documents:</span>
              <span className="font-medium text-foreground">{uploadedFiles.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pages:</span>
              <span className="font-medium text-foreground">{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Document quality:</span>
              <span className="font-medium text-foreground">
                {ocrQuality === 'high' ? '✨ High Quality' : '⚡ Standard Quality'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price per page:</span>
              <span className="font-medium text-foreground">${PRICE_PER_PAGE}</span>
            </div>
            <div className="bg-muted/40 p-3 rounded">
              <div className="text-sm text-muted-foreground mb-1">
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
            <p className="text-sm text-muted-foreground mb-4">
              Create your order now and pay later. We will start processing after payment is completed.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateOrder}
            className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!targetLanguage}
          >
            Create Order (Pay Later)
          </button>
        </div>
      )}

      {/* Pay now (optional) after order exists */}
      {createdOrder && !isProcessing && (
        <div className="border-t pt-6 space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Order created:</strong> {createdOrder.orderNumber}. Payment is required before we start processing.
              You can pay now below or later from your Orders page.
            </p>
          </div>

          <a
            href={`/user/orders/${createdOrder.orderId}`}
            className="block w-full text-center bg-foreground text-background px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
          >
            View Order
          </a>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Pay Now (optional)</h3>
            <PayPalButton amount={totalAmount} orderId={createdOrder.orderId} onSuccess={handlePaymentSuccess} />
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border-t pt-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Processing your order...</p>
          </div>
        </div>
      )}
    </div>
  );
}

