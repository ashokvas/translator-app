'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FileUpload } from './file-upload';
import { PayPalButton } from './paypal-button';
import { LANGUAGES, getLanguageLabel, getLanguageName } from '@/lib/languages';
import { Id } from '@/convex/_generated/dataModel';
import { Select, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  storageId?: string;
  fileSize: number;
  pageCount: number;
  fileType: string;
}

type OcrQuality = 'low' | 'high';
type ServiceType = 'certified' | 'general' | 'custom';
type DocumentDomain = 'general' | 'certificate' | 'legal' | 'medical' | 'technical';

interface ServiceOrderFormProps {
  serviceType: ServiceType;
  serviceName: string;
  serviceDescription: string;
}

const OCR_QUALITY_OPTIONS = [
  {
    value: 'high' as const,
    label: 'High Quality',
    description: 'Best for scanned documents, photos of documents, or low-quality images. Applies image enhancement for better OCR accuracy.',
    icon: '✨',
  },
  {
    value: 'low' as const,
    label: 'Standard Quality',
    description: 'Best for clear digital documents, high-resolution images, or when faster processing is preferred.',
    icon: '⚡',
  },
];

const DOCUMENT_DOMAINS: Array<{ value: DocumentDomain; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'certificate', label: 'Certificate/Official' },
  { value: 'legal', label: 'Legal' },
  { value: 'medical', label: 'Medical' },
  { value: 'technical', label: 'Technical' },
];

export function ServiceOrderForm({ serviceType, serviceName, serviceDescription }: ServiceOrderFormProps) {
  const { user } = useUser();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const sourceLanguage = 'auto';
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [documentDomain, setDocumentDomain] = useState<DocumentDomain>('general');
  const [remarks, setRemarks] = useState<string>('');
  const [isRush, setIsRush] = useState(false);
  const [ocrQuality, setOcrQuality] = useState<OcrQuality>('high');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

  const createOrder = useMutation(api.orders.createOrder);
  const pricing = useQuery(api.settings.getPricing);

  const totalPages = uploadedFiles.reduce((sum, file) => sum + file.pageCount, 0);

  // Calculate total amount based on service type and pricing
  const calculateAmount = () => {
    if (serviceType === 'custom') {
      return 0; // Custom orders are quote-based
    }

    if (!pricing) return 0;

    const serviceConfig = serviceType === 'certified' ? pricing.certified : pricing.general;
    const baseRate = serviceConfig.basePerPage;
    const rushExtra = isRush ? serviceConfig.rushExtraPerPage : 0;
    const ratePerPage = baseRate + rushExtra;

    return totalPages * ratePerPage;
  };

  const totalAmount = calculateAmount();

  const handlePaymentSuccess = async (paymentId: string) => {
    setIsProcessing(true);
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

    if (!documentDomain) {
      setNotice({ title: 'Invalid document type', message: 'Please select a document type.' });
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
        serviceType: serviceType,
        isRush: isRush,
        documentDomain: documentDomain,
        remarks: remarks.trim() || undefined,
        files: filesForOrder,
        totalPages,
        amount: totalAmount,
        sourceLanguage,
        targetLanguage,
        ocrQuality,
      });

      setCreatedOrder({ orderId: result.orderId, orderNumber: result.orderNumber });

      // Send appropriate email based on service type
      const emailKind = serviceType === 'custom' ? 'order_created' : 'order_created';
      await fetch('/api/send-order-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: emailKind,
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

      if (serviceType === 'custom') {
        setNotice({
          title: 'Quote request submitted',
          message: 'Your custom translation request has been submitted. We will review it and send you a quote within 24 hours.',
        });
      }
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

      {/* Service Info */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h3 className="font-semibold text-foreground mb-1">{serviceName}</h3>
        <p className="text-sm text-muted-foreground">{serviceDescription}</p>
      </div>

      {/* Language Selection */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Translation Language</h2>
        <div>
          <label htmlFor="target-language" className="block text-sm font-medium text-foreground mb-2">
            Target Language
          </label>
          <Select id="target-language" value={targetLanguage} onValueChange={setTargetLanguage}>
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

      {/* Document Type */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Document Type</h2>
        <Select id="document-domain" value={documentDomain} onValueChange={(v) => setDocumentDomain(v as DocumentDomain)}>
          {DOCUMENT_DOMAINS.map((domain) => (
            <SelectItem key={domain.value} value={domain.value}>
              {domain.label}
            </SelectItem>
          ))}
        </Select>
        <p className="mt-2 text-sm text-muted-foreground">
          Select the type that best matches your document for optimal translation quality.
        </p>
      </div>

      {/* File Upload */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Upload Documents</h2>
        <FileUpload uploadedFiles={uploadedFiles} onFilesUploaded={setUploadedFiles} />
      </div>

      {/* Rush Service Checkbox */}
      {uploadedFiles.length > 0 && (
        <div className="border-t pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isRush}
              onChange={(e) => setIsRush(e.target.checked)}
              className="mt-1 h-5 w-5 text-primary rounded focus:ring-primary"
            />
            <div className="flex-1">
              <div className="font-semibold text-foreground">Rush Service (24-hour delivery)</div>
              <p className="text-sm text-muted-foreground mt-1">
                {serviceType === 'custom'
                  ? 'Request rush delivery for your custom order. Final pricing will be included in your quote.'
                  : pricing
                  ? `Additional $${
                      serviceType === 'certified' ? pricing.certified.rushExtraPerPage : pricing.general.rushExtraPerPage
                    } per page`
                  : 'Loading pricing...'}
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Special Instructions */}
      {uploadedFiles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Special Instructions (Optional)</h2>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter any special instructions, terminology preferences, or specific requirements for your translation..."
            rows={4}
            className="w-full"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Let us know if you have any specific requirements for your translation.
          </p>
        </div>
      )}

      {/* Order Summary */}
      {uploadedFiles.length > 0 && (
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service Type:</span>
              <span className="font-medium text-foreground">{serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Language:</span>
              <span className="font-medium text-foreground">{getLanguageName(targetLanguage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Document Type:</span>
              <span className="font-medium text-foreground">
                {DOCUMENT_DOMAINS.find((d) => d.value === documentDomain)?.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number of documents:</span>
              <span className="font-medium text-foreground">{uploadedFiles.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pages:</span>
              <span className="font-medium text-foreground">
                {totalPages} page{totalPages !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery:</span>
              <span className="font-medium text-foreground">{isRush ? '24 hours (Rush)' : '7 days (Standard)'}</span>
            </div>
            {serviceType !== 'custom' && pricing && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per page:</span>
                  <span className="font-medium text-foreground">
                    ${serviceType === 'certified' ? pricing.certified.basePerPage : pricing.general.basePerPage}
                    {isRush && ` + $${serviceType === 'certified' ? pricing.certified.rushExtraPerPage : pricing.general.rushExtraPerPage} (rush)`}
                  </span>
                </div>
                <div className="bg-muted/40 p-3 rounded">
                  <div className="text-sm text-muted-foreground mb-1">
                    Calculation: {totalPages} page{totalPages !== 1 ? 's' : ''} × $
                    {(totalAmount / totalPages).toFixed(2)} = ${totalAmount.toFixed(2)}
                  </div>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            {serviceType === 'custom' && (
              <div className="bg-muted/40 border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Custom Quote:</strong> Your order will be reviewed by our team, and we'll send you a detailed quote within 24 hours.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Order Button */}
      {uploadedFiles.length > 0 && !isProcessing && !createdOrder && (
        <div className="border-t pt-6">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-4">
              {serviceType === 'custom'
                ? 'Submit your request for a custom quote. We will review your requirements and send you a quote within 24 hours.'
                : 'Create your order now and pay later. We will start processing after payment is completed.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateOrder}
            className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!targetLanguage || !documentDomain}
          >
            {serviceType === 'custom' ? 'Request Custom Quote' : 'Create Order (Pay Later)'}
          </button>
        </div>
      )}

      {/* Payment Section (for non-custom orders) */}
      {createdOrder && !isProcessing && serviceType !== 'custom' && (
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

      {/* Custom Order Confirmation */}
      {createdOrder && serviceType === 'custom' && (
        <div className="border-t pt-6">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-foreground mb-2">
              <strong>✓ Request submitted:</strong> {createdOrder.orderNumber}
            </p>
            <p className="text-sm text-muted-foreground">
              Thank you for your custom translation request! Our team will review your requirements and send you a detailed quote within 24 hours. You'll receive an email with the quote and a link to complete payment.
            </p>
          </div>

          <a
            href="/user/orders"
            className="mt-4 block w-full text-center bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
          >
            View My Orders
          </a>
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
