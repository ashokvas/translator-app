/**
 * Admin Order Management Component
 * 
 * NOTE: This component displays the Translation column in the admin order table.
 * Translation information is visible to admins for order management purposes, but
 * is hidden from users in their dashboard and emails.
 */
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser, useAuth } from '@clerk/nextjs';
import { format } from 'date-fns';
import { getLanguageName, getSourceLanguageDisplay } from '@/lib/languages';
import { Id } from '@/convex/_generated/dataModel';
import type { Doc } from '@/convex/_generated/dataModel';
import { TranslationReview } from './translation-review';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';
import {
  DOCUMENT_DOMAINS,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_MODEL_PRESETS,
  TRANSLATION_PROVIDERS,
  type DocumentDomain,
  type TranslationProvider,
} from '@/lib/translation-providers';

// Extended order type with user information
type OrderWithUser = Doc<'orders'> & {
  userEmail?: string;
  userName?: string | null;
  userTelephone?: string | null;
  detectedSourceLanguage?: string | null;
};

export function OrderManagement() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const orders = useQuery(
    api.orders.getAllOrders,
    user?.id ? { clerkId: user.id } : 'skip'
  ) as OrderWithUser[] | undefined;
  const [selectedOrder, setSelectedOrder] = useState<Id<'orders'> | null>(null);
  const [translatedFiles, setTranslatedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Support parallel translations - track multiple file indexes being translated
  const [translatingFileIndexes, setTranslatingFileIndexes] = useState<Set<number>>(new Set());
  const [reviewingFileIndex, setReviewingFileIndex] = useState<number | null>(null);
  const [translationProgress, setTranslationProgress] = useState<Record<number, number>>({});
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>('openrouter');
  const [documentDomain, setDocumentDomain] = useState<DocumentDomain>('general');
  const [openRouterModel, setOpenRouterModel] = useState<string>('openai/gpt-5.2');
  const [ocrQuality, setOcrQuality] = useState<'high' | 'low'>('high');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Approved files selection for combined export
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set());
  // Export format selection
  const [exportFormat, setExportFormat] = useState<'docx' | 'pdf'>('docx');
  const [isGeneratingCombined, setIsGeneratingCombined] = useState(false);
  const [isGeneratingIndividual, setIsGeneratingIndividual] = useState<Set<string>>(new Set());

  const orderDetails = useQuery(
    api.orders.getOrderWithFiles,
    selectedOrder && user?.id
      ? { orderId: selectedOrder, clerkId: user.id }
      : 'skip'
  );

  const uploadTranslatedFiles = useMutation(api.orders.uploadTranslatedFiles);
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);
  const updateOrderPayment = useMutation(api.orders.updateOrderPayment);
  const setQuoteAmount = useMutation(api.orders.setQuoteAmount);
  const updateTranslationProgress = useMutation(api.translations.updateTranslationProgress);
  const deleteTranslation = useMutation(api.translations.deleteTranslation);
  const deleteTranslatedFile = useMutation(api.orders.deleteTranslatedFile);

  // Quote management state
  const [quoteAmountInput, setQuoteAmountInput] = useState<string>('');
  const [isSendingQuote, setIsSendingQuote] = useState(false);

  // Subscribe to translation progress
  const translations = useQuery(
    api.translations.getTranslationsByOrder,
    selectedOrder && user?.id
      ? { orderId: selectedOrder, clerkId: user.id }
      : 'skip'
  );

  // Monitor translation progress and update UI
  useEffect(() => {
    if (!translations || !orderDetails) return;

    translations.forEach((translation: any) => {
      const fileIndex = orderDetails.files.findIndex(
        (f: any) => f.fileName === translation.fileName
      );
      if (fileIndex !== -1) {
        setTranslationProgress((prev) => ({
          ...prev,
          [fileIndex]: translation.progress,
        }));

        // Stop the local "Translating..." UI whenever the backend record is no longer translating.
        // This prevents the UI from getting stuck at 0% if the API fails and resets status to pending.
        if (translation.status !== 'translating') {
          setTranslatingFileIndexes((prev) => {
            if (prev.has(fileIndex)) {
              const next = new Set(prev);
              next.delete(fileIndex);
              return next;
            }
            return prev;
          });
        }
      }
    });
  }, [translations, orderDetails]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTranslatedFiles(Array.from(e.target.files));
    }
  };

  const handleUploadTranslations = async () => {
    if (!selectedOrder || !user?.id || translatedFiles.length === 0) {
      setNotice({ title: 'Missing files', message: 'Please select translated files to upload.' });
      return;
    }

    setIsUploading(true);
    try {
      // Upload translated files to Convex storage via our API route
      const uploadedTranslatedFiles = await Promise.all(
        translatedFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('files', file);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error || `Failed to upload ${file.name}: ${response.statusText}`
            );
          }

          const data = await response.json();
          const fileData = data.files[0]; // Get first file from response

          // Find corresponding original file
          const originalFile =
            orderDetails?.files.find((f: any) =>
              file.name.toLowerCase().includes(f.fileName.toLowerCase())
            ) || orderDetails?.files[0];

          // Convert storageId string to Convex ID
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const storageId = fileData.storageId as any as Id<'_storage'>;

          return {
            fileName: file.name,
            fileUrl: fileData.fileUrl,
            storageId,
            fileSize: fileData.fileSize,
            fileType: fileData.fileType,
            originalFileName: originalFile?.fileName || file.name,
          };
        })
      );

      await uploadTranslatedFiles({
        orderId: selectedOrder,
        clerkId: user.id,
        translatedFiles: uploadedTranslatedFiles,
      });

      setNotice({ title: 'Uploaded', message: 'Translated files uploaded successfully!' });
      setTranslatedFiles([]);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Upload error:', error);
      setNotice({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranslate = async (fileIndex: number) => {
    if (!selectedOrder || !user?.id || !orderDetails) return;

    const canTranslate =
      orderDetails.status === 'paid' ||
      orderDetails.status === 'processing' ||
      orderDetails.status === 'completed';
    if (!canTranslate) {
      setNotice({
        title: 'Payment pending',
        message: 'Translation is disabled until the order is marked as Paid (or Processing/Completed).',
      });
      return;
    }

    const file = orderDetails.files[fileIndex];
    // Add to set of translating files (supports parallel translations)
    setTranslatingFileIndexes((prev) => new Set(prev).add(fileIndex));
    setTranslationProgress((prev) => ({ ...prev, [fileIndex]: 0 }));

    try {
      // Update progress to translating
      // Use API subdomain in production (bypasses Cloudflare 100s timeout limit)
      // Use local server in development
      const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isDev ? '' : 'https://api.translatoraxis.com';
      // Get auth token to pass to API subdomain (cookies aren't shared between subdomains)
      const token = await getToken();
      const response = await fetch(`${apiBase}/api/translate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId: selectedOrder,
          fileName: file.fileName,
          fileIndex,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          sourceLanguage: orderDetails.sourceLanguage,
          targetLanguage: orderDetails.targetLanguage,
          translationProvider,
          documentDomain,
          openRouterModel: translationProvider === 'openrouter' ? openRouterModel : undefined,
          ocrQuality,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const errorData = (() => {
          try {
            return errorText ? (JSON.parse(errorText) as any) : {};
          } catch {
            return {};
          }
        })();
        throw new Error(
          errorData?.details ||
            errorData?.error ||
            errorText ||
            `Translation failed (HTTP ${response.status})`
        );
      }

      // The translations query will automatically update via Convex subscription
      // We'll monitor it via useEffect instead of polling
      setNotice({
        title: 'Translation started',
        message: 'Translation started. Progress will update automatically.',
      });
    } catch (error) {
      console.error('Translation error:', error);
      setNotice({
        title: 'Translation failed',
        message: error instanceof Error ? error.message : String(error),
      });
      // Remove from translating set on error
      setTranslatingFileIndexes((prev) => {
        const next = new Set(prev);
        next.delete(fileIndex);
        return next;
      });
    }
  };

  // Handle translating all files at once
  const handleTranslateAll = async () => {
    if (!selectedOrder || !user?.id || !orderDetails) return;
    
    const canTranslate =
      orderDetails.status === 'paid' ||
      orderDetails.status === 'processing' ||
      orderDetails.status === 'completed';
    if (!canTranslate) {
      setNotice({
        title: 'Payment pending',
        message: 'Translation is disabled until the order is marked as Paid (or Processing/Completed).',
      });
      return;
    }

    // Get files that haven't been translated yet or need retranslation
    const filesToTranslate = orderDetails.files
      .map((file: any, index: number) => ({ file, index }))
      .filter(({ index }: { index: number }) => !translatingFileIndexes.has(index));

    if (filesToTranslate.length === 0) {
      setNotice({ title: 'No files', message: 'All files are already being translated.' });
      return;
    }

    setNotice({
      title: 'Starting translations',
      message: `Starting translation for ${filesToTranslate.length} file(s)...`,
    });

    // Start all translations in parallel
    await Promise.all(filesToTranslate.map(({ index }: { index: number }) => handleTranslate(index)));
  };

  // Handle generating individual document with format selection
  const handleGenerateIndividualDocument = async (fileName: string) => {
    if (!selectedOrder || !user?.id || !translations) return;

    const translation = translations.find((t: any) => t.fileName === fileName);
    if (!translation) {
      setNotice({ title: 'Error', message: 'Translation not found' });
      return;
    }

    setIsGeneratingIndividual((prev) => new Set(prev).add(fileName));

    try {
      const response = await fetch('/api/generate-translated-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translationId: translation._id,
          orderId: selectedOrder,
          fileName,
          format: exportFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate document');
      }

      const result = await response.json();
      
      // Download the file
      if (result.fileUrl) {
        window.open(result.fileUrl, '_blank');
      }

      setNotice({
        title: 'Document Generated',
        message: `${result.fileName} has been generated and added to the order.`,
      });
    } catch (error) {
      console.error('Document generation error:', error);
      setNotice({
        title: 'Generation failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGeneratingIndividual((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
    }
  };

  // Handle generating combined document from selected translations
  const handleGenerateCombinedDocument = async () => {
    if (!selectedOrder || !user?.id || selectedForCombine.size === 0) {
      setNotice({ title: 'No selection', message: 'Please select files to combine.' });
      return;
    }

    setIsGeneratingCombined(true);

    try {
      const response = await fetch('/api/generate-combined-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder,
          fileNames: Array.from(selectedForCombine),
          format: exportFormat,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate combined document');
      }

      const result = await response.json();

      // Download the file
      if (result.fileUrl) {
        window.open(result.fileUrl, '_blank');
      }

      setNotice({
        title: 'Combined Document Generated',
        message: `${result.fileName} has been generated with ${selectedForCombine.size} translations.`,
      });
    } catch (error) {
      console.error('Combined document generation error:', error);
      setNotice({
        title: 'Generation failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGeneratingCombined(false);
    }
  };

  // Handle downloading all approved translations separately
  const handleDownloadAllSeparately = async () => {
    if (!translations) return;

    const approvedTranslations = translations.filter((t: any) => t.status === 'approved');
    if (approvedTranslations.length === 0) {
      setNotice({ title: 'No files', message: 'No approved translations to download.' });
      return;
    }

    setNotice({
      title: 'Generating documents',
      message: `Generating ${approvedTranslations.length} document(s)...`,
    });

    // Generate all documents in parallel
    await Promise.all(
      approvedTranslations.map((t: any) => handleGenerateIndividualDocument(t.fileName))
    );
  };

  // Handle deleting an approved translation
  const handleDeleteTranslation = async (translationId: Id<'translations'>, fileName: string) => {
    if (!user?.id) return;

    if (!confirm(`Are you sure you want to delete the approved translation for "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteTranslation({
        translationId,
        clerkId: user.id,
      });

      // Remove from selected set if it was selected
      setSelectedForCombine((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });

      setNotice({
        title: 'Deleted',
        message: `Approved translation for "${fileName}" has been deleted.`,
      });
    } catch (error) {
      console.error('Delete translation error:', error);
      setNotice({
        title: 'Delete failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Handle deleting a translated file
  const handleDeleteTranslatedFile = async (fileName: string) => {
    if (!selectedOrder || !user?.id) return;

    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteTranslatedFile({
        orderId: selectedOrder,
        fileName,
        clerkId: user.id,
      });

      setNotice({
        title: 'Deleted',
        message: `Translated file "${fileName}" has been deleted.`,
      });
    } catch (error) {
      console.error('Delete translated file error:', error);
      setNotice({
        title: 'Delete failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleStatusChange = async (orderId: Id<'orders'>, newStatus: string) => {
    if (!user?.id) return;

    try {
      if (newStatus === 'quote_pending') {
        // `updateOrderStatus` doesn't support quote_pending; this is set via custom-order quote flow.
        setNotice({
          title: 'Not allowed',
          message: 'Use “Set Quote & Notify Customer” for custom orders. Status will update automatically.',
        });
        return;
      }

      if (newStatus === 'paid') {
        // Manual/direct payments can happen outside the app; record a manual marker so translation can proceed.
        await updateOrderPayment({
          orderId,
          paymentId: `manual-admin-${Date.now()}`,
          paymentStatus: 'COMPLETED',
        });
        setNotice({ title: 'Updated', message: 'Order marked as paid.' });
        return;
      }

      await updateOrderStatus({
        orderId,
        clerkId: user.id,
        status: newStatus as
          | 'pending'
          | 'paid'
          | 'processing'
          | 'completed'
          | 'cancelled',
      });
      setNotice({ title: 'Updated', message: 'Order status updated successfully!' });
    } catch (error) {
      console.error('Status update error:', error);
      setNotice({
        title: 'Update failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="space-y-6">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />

      <h2 className="text-2xl font-bold text-foreground">Order Management</h2>

      {/* Orders List */}
      <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">All Orders</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {orders ? `${orders.length} order${orders.length !== 1 ? 's' : ''} total` : 'Loading...'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date of Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Amount Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Telephone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Translation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {orders === undefined ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-muted-foreground">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div>
                        <div className="font-medium">
                          {format(new Date(order.createdAt), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(order.createdAt), 'h:mm a')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                      ${order.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {order.userName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {order.userEmail || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {order.userTelephone || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        (order as any).serviceType === 'certified'
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : (order as any).serviceType === 'general'
                          ? 'bg-cyan-500/15 text-cyan-300'
                          : (order as any).serviceType === 'custom'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {(order as any).serviceType === 'certified' ? 'Certified' : (order as any).serviceType === 'general' ? 'General' : (order as any).serviceType === 'custom' ? 'Custom' : 'General'}
                      </span>
                      {(order as any).isRush === true && (
                        <span className="ml-1 px-2 py-1 rounded text-xs font-medium bg-orange-500/15 text-orange-400">
                          Rush
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <span className="font-medium">{getSourceLanguageDisplay(order.sourceLanguage, order.detectedSourceLanguage)}</span>
                        <span className="mx-2">→</span>
                        <span className="font-medium">{getLanguageName(order.targetLanguage)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {order.totalPages} {order.totalPages === 1 ? 'page' : 'pages'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order._id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground ${
                          order.status === 'completed'
                            ? 'bg-green-500/10 text-green-400'
                            : order.status === 'processing'
                            ? 'bg-primary/10 text-primary'
                            : order.status === 'paid'
                            ? 'bg-purple-500/10 text-purple-300'
                            : order.status === 'quote_pending'
                            ? 'bg-purple-500/10 text-purple-300'
                            : order.status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-300'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        <option value="quote_pending">Quote Pending</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedOrder(order._id)}
                        className="text-primary hover:opacity-90 font-medium"
                      >
                        View & Translate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details & Translation Upload */}
      {selectedOrder && orderDetails && (
        <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Order: {orderDetails.orderNumber}
          </h3>

          {/* Workflow Guidance */}
          {orderDetails.status === 'pending' ? (
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">
                <strong>Step 1 — Payment required.</strong> This order has been created, but the client hasn’t paid yet.
                Ask the client to pay from their dashboard (or confirm direct payment). Once paid, set status to <strong>Paid</strong> (or <strong>Processing</strong>) and start translation.
              </p>
            </div>
          ) : orderDetails.status === 'paid' ? (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                <strong>Step 2 — Ready to translate.</strong> Download the original files below, translate them, then upload the translated files.
              </p>
            </div>
          ) : orderDetails.status === 'processing' ? (
            <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm text-indigo-900">
                <strong>Step 3 — In progress.</strong> Upload translated files when ready to complete the order.
              </p>
            </div>
          ) : orderDetails.status === 'completed' ? (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-900">
                <strong>Completed.</strong> Translated files are attached to this order.
              </p>
            </div>
          ) : orderDetails.status === 'quote_pending' ? (
            <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <p className="text-sm text-purple-900">
                <strong>Custom Quote Pending.</strong> This is a custom translation order. Set the quote amount below and send it to the customer.
              </p>
            </div>
          ) : null}

          {/* Custom Quote Management */}
          {orderDetails.status === 'quote_pending' && (orderDetails as any).serviceType === 'custom' && (
            <div className="mb-6 border border-border rounded-lg p-6 bg-muted/40">
              <h4 className="font-semibold text-foreground mb-4">Set Custom Quote</h4>
              
              {/* Order Info */}
              <div className="bg-background rounded-lg p-4 mb-4 border border-border">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Service Type:</span>
                    <span className="ml-2 font-medium text-foreground">Custom Translation</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Pages:</span>
                    <span className="ml-2 font-medium text-foreground">{orderDetails.totalPages}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rush Requested:</span>
                    <span className="ml-2 font-medium text-foreground">{(orderDetails as any).isRush ? 'Yes (24h)' : 'No (7 days)'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Document Type:</span>
                    <span className="ml-2 font-medium text-foreground capitalize">{(orderDetails as any).documentDomain || 'General'}</span>
                  </div>
                </div>
                {(orderDetails as any).remarks && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-muted-foreground text-sm font-medium">Special Instructions:</span>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{(orderDetails as any).remarks}</p>
                  </div>
                )}
              </div>

              {/* Quote Amount Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Quote Amount (USD)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-lg">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quoteAmountInput}
                    onChange={(e) => setQuoteAmountInput(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the total quote amount for this custom translation order.
                </p>
              </div>

              {/* Send Quote Button */}
              <Button
                onClick={async () => {
                  if (!user?.id || !selectedOrder) return;
                  
                  const amount = parseFloat(quoteAmountInput);
                  if (isNaN(amount) || amount <= 0) {
                    setNotice({ title: 'Invalid amount', message: 'Please enter a valid quote amount.' });
                    return;
                  }

                  setIsSendingQuote(true);
                  try {
                    // Set quote amount in database
                    await setQuoteAmount({
                      orderId: selectedOrder,
                      quoteAmount: amount,
                      clerkId: user.id,
                    });

                    // Send quote ready email
                    const order = orders?.find((o) => o._id === selectedOrder);
                    if (order) {
                      await fetch('/api/send-order-confirmation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          kind: 'quote_ready',
                          orderId: selectedOrder,
                          orderNumber: order.orderNumber,
                          amount,
                          totalPages: order.totalPages,
                          fileCount: order.files.length,
                          sourceLanguage: order.sourceLanguage,
                          targetLanguage: order.targetLanguage,
                          email: order.userEmail,
                          customerName: order.userName,
                        }),
                      });
                    }

                    setNotice({
                      title: 'Quote sent',
                      message: 'Quote has been set and customer has been notified via email.',
                    });
                    setQuoteAmountInput('');
                  } catch (error) {
                    console.error('Failed to send quote:', error);
                    setNotice({
                      title: 'Failed to send quote',
                      message: error instanceof Error ? error.message : String(error),
                    });
                  } finally {
                    setIsSendingQuote(false);
                  }
                }}
                disabled={isSendingQuote || !quoteAmountInput || parseFloat(quoteAmountInput) <= 0}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isSendingQuote ? 'Sending Quote...' : 'Set Quote & Notify Customer'}
              </Button>
            </div>
          )}

          {/* Translation Model (recommended) & Domain */}
          {orderDetails.status !== 'pending' && (
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Model
                </label>
                <Select
                  value={`${translationProvider}:${translationProvider === 'openrouter' ? openRouterModel : ''}`}
                  onValueChange={(value) => {
                    if (value === 'google:') {
                      setTranslationProvider('google');
                      return;
                    }
                    if (value.startsWith('openrouter:')) {
                      setTranslationProvider('openrouter');
                      setOpenRouterModel(value.slice('openrouter:'.length) || OPENROUTER_DEFAULT_MODEL);
                      return;
                    }
                  }}
                >
                  <SelectItem value="openrouter:openai/gpt-5.2">
                    OpenAI GPT-5.2 (best quality)
                  </SelectItem>
                  <SelectItem value="openrouter:openai/gpt-4o">
                    OpenAI GPT-4o (recommended)
                  </SelectItem>
                  <SelectItem value="openrouter:anthropic/claude-sonnet-4">
                    Claude Sonnet 4 (fast)
                  </SelectItem>
                  <SelectItem value="google:">Google Cloud Translation</SelectItem>
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Tip: AI models (OpenRouter) provide context-aware translation. Google uses Neural Machine Translation.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Domain
                </label>
                <Select
                  value={documentDomain}
                  onValueChange={(v) => setDocumentDomain(v as DocumentDomain)}
                >
                  {DOCUMENT_DOMAINS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {orderDetails.status !== 'pending' && (
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                OCR quality
              </label>
              <Select value={ocrQuality} onValueChange={(v) => setOcrQuality(v as 'high' | 'low')}>
                <SelectItem value="high">High (recommended for scans)</SelectItem>
                <SelectItem value="low">Low (faster / cleaner simple images)</SelectItem>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                Applies to scanned PDFs/images (OCR). Text PDFs/DOCX/XLSX are unaffected.
              </p>
            </div>
          )}

          {orderDetails.status !== 'pending' && translationProvider === 'openrouter' && (
            <div className="mb-6">
              <label className="block text-xs font-medium text-foreground mb-1">
                OpenRouter model
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={openRouterModel} onValueChange={setOpenRouterModel}>
                  {OPENROUTER_MODEL_PRESETS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </Select>
                <input
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
                  className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 text-sm"
                  placeholder="e.g. anthropic/claude-3.5-sonnet"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: paste any OpenRouter model ID (from your OpenRouter dashboard models list).
              </p>
            </div>
          )}

          {/* Original Files with Translate buttons */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-foreground">Original Files:</h4>
              {orderDetails.files.length > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTranslateAll}
                  disabled={translatingFileIndexes.size === orderDetails.files.length}
                >
                  Translate All
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {orderDetails.files.map((file: any, index: number) => {
                const isTranslating = translatingFileIndexes.has(index);
                const progress = translationProgress[index] || 0;
                // Handle case where translations query is still loading or failed
                const translation = translations === undefined ? undefined : translations.find((t: any) => t.fileName === file.fileName);
                const canTranslate =
                  orderDetails.status === 'paid' ||
                  orderDetails.status === 'processing' ||
                  orderDetails.status === 'completed';
                const showReviewButton =
                  canTranslate &&
                  !!translation &&
                  (translation.status === 'review' || translation.status === 'approved');

                // Always show a translate-style button when allowed (even if a translation already exists).
                // If a translation exists, it becomes "Retranslate".
                const showTranslateAction = !isTranslating;
                const translateActionLabel = translation ? 'Retranslate' : 'Translate';

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.pageCount} page{file.pageCount !== 1 ? 's' : ''}
                      </p>
                      {isTranslating && (
                        <div className="mt-2 space-y-1">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">Translating... {progress}%</p>
                        </div>
                      )}
                      {translation && translation.status === 'review' && !isTranslating && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Translation ready for review
                        </p>
                      )}
                      {translation && translation.status === 'approved' && !isTranslating && (
                        <p className="text-xs text-blue-600 mt-1">✓ Translation approved</p>
                      )}
                      {!canTranslate && (
                        <p className="text-xs text-yellow-600 mt-1">
                          ⚠ Change order status from "Pending" to "Paid" or "Processing" to enable translation
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:opacity-90 text-sm"
                      >
                        Download
                      </a>
                      {showReviewButton && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewingFileIndex(index)}
                        >
                          Review
                        </Button>
                      )}
                      {showTranslateAction && (
                        <Button
                          size="sm"
                          onClick={() => handleTranslate(index)}
                          disabled={isTranslating}
                        >
                          {translateActionLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approved Translations Section */}
          {translations && translations.filter((t: any) => t.status === 'approved').length > 0 && (
            <div className="mb-6 border border-border rounded-lg p-4 bg-muted/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">
                  Approved Translations ({translations.filter((t: any) => t.status === 'approved').length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const approvedFileNames = translations
                        .filter((t: any) => t.status === 'approved')
                        .map((t: any) => t.fileName);
                      if (selectedForCombine.size === approvedFileNames.length) {
                        setSelectedForCombine(new Set());
                      } else {
                        setSelectedForCombine(new Set(approvedFileNames));
                      }
                    }}
                    className="text-xs text-primary hover:opacity-90"
                  >
                    {selectedForCombine.size === translations.filter((t: any) => t.status === 'approved').length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div className="mb-4 p-3 bg-background rounded-md border border-border">
                <label className="block text-xs font-medium text-foreground mb-2">
                  Download Format:
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="docx"
                      checked={exportFormat === 'docx'}
                      onChange={() => setExportFormat('docx')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">Word (.docx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={() => setExportFormat('pdf')}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">PDF (.pdf)</span>
                  </label>
                </div>
              </div>

              {/* Approved Files List with Checkboxes */}
              <div className="space-y-2 mb-4">
                {translations
                  .filter((t: any) => t.status === 'approved')
                  .map((translation: any) => (
                    <div
                      key={translation._id}
                      className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedForCombine.has(translation.fileName)}
                          onChange={(e) => {
                            setSelectedForCombine((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) {
                                next.add(translation.fileName);
                              } else {
                                next.delete(translation.fileName);
                              }
                              return next;
                            });
                          }}
                          className="h-4 w-4 text-primary rounded focus:ring-primary"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{translation.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {translation.segments.length} segment(s) •{' '}
                            {getLanguageName(translation.targetLanguage)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs text-green-400 font-medium block">✓ Approved</span>
                          {translation.approvedAt && (
                            <span className="text-xs text-muted-foreground block">
                              {format(new Date(translation.approvedAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isGeneratingIndividual.has(translation.fileName)}
                          onClick={() => handleGenerateIndividualDocument(translation.fileName)}
                        >
                          {isGeneratingIndividual.has(translation.fileName) ? 'Generating...' : `Download ${exportFormat.toUpperCase()}`}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTranslation(translation._id, translation.fileName)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Combined Download Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <Button
                  onClick={handleGenerateCombinedDocument}
                  disabled={selectedForCombine.size === 0 || isGeneratingCombined}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isGeneratingCombined
                    ? 'Generating...'
                    : `Generate Combined ${exportFormat.toUpperCase()} (${selectedForCombine.size} files)`}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadAllSeparately}
                  disabled={isGeneratingCombined || translations.filter((t: any) => t.status === 'approved').length === 0}
                >
                  Download All Separately
                </Button>
              </div>
            </div>
          )}

          {/* Translated Files (if uploaded) */}
          {orderDetails.translatedFiles && orderDetails.translatedFiles.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-foreground mb-2">Translated Files:</h4>
              <div className="space-y-2">
                {orderDetails.translatedFiles.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {getLanguageName(orderDetails.targetLanguage)}
                        {file.translatedAt && (
                          <span className="ml-2">
                            • Translated: {format(new Date(file.translatedAt), 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:opacity-90 text-sm"
                      >
                        Download
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTranslatedFile(file.fileName)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Translated Files */}
          {orderDetails.status !== 'completed' && (
            <div className="border-t pt-6">
              <h4 className="font-medium text-foreground mb-4">
                Upload Translated Files ({getLanguageName(orderDetails.targetLanguage)}):
              </h4>
              {orderDetails.status === 'pending' && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-sm text-yellow-900">
                    Payment has not been completed yet. Uploading translations is disabled until the order is marked as <strong>Paid</strong> or <strong>Processing</strong>.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".pdf,image/*"
                  disabled={orderDetails.status === 'pending'}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/15"
                />
                {translatedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Selected files:</p>
                    {translatedFiles.map((file, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        • {file.name}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleUploadTranslations}
                  disabled={orderDetails.status === 'pending' || translatedFiles.length === 0 || isUploading}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload Translations'}
                </button>
              </div>
            </div>
          )}

          {/* Translation Review Modal */}
          {reviewingFileIndex !== null && orderDetails && (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-card text-card-foreground rounded-lg border border-border shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto p-6">
                <TranslationReview
                  orderId={selectedOrder}
                  fileName={orderDetails.files[reviewingFileIndex].fileName}
                  fileIndex={reviewingFileIndex}
                  fileUrl={orderDetails.files[reviewingFileIndex].fileUrl}
                  fileType={orderDetails.files[reviewingFileIndex].fileType}
                  sourceLanguage={orderDetails.sourceLanguage}
                  targetLanguage={orderDetails.targetLanguage}
                  onClose={() => setReviewingFileIndex(null)}
                  onApprove={() => {
                    setReviewingFileIndex(null);
                    // Refresh translations
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

