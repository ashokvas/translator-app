'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser, useAuth } from '@clerk/nextjs';
import { format } from 'date-fns';
import { getLanguageName } from '@/lib/languages';
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
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>('google');
  const [documentDomain, setDocumentDomain] = useState<DocumentDomain>('general');
  const [openRouterModel, setOpenRouterModel] = useState<string>(OPENROUTER_DEFAULT_MODEL);
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
  const updateTranslationProgress = useMutation(api.translations.updateTranslationProgress);
  const deleteTranslation = useMutation(api.translations.deleteTranslation);
  const deleteTranslatedFile = useMutation(api.orders.deleteTranslatedFile);

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

    translations.forEach((translation) => {
      const fileIndex = orderDetails.files.findIndex(
        (f) => f.fileName === translation.fileName
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
            orderDetails?.files.find((f) =>
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
    
    const canTranslate = orderDetails.status !== 'pending';
    if (!canTranslate) return;

    // Get files that haven't been translated yet or need retranslation
    const filesToTranslate = orderDetails.files
      .map((file, index) => ({ file, index }))
      .filter(({ index }) => !translatingFileIndexes.has(index));

    if (filesToTranslate.length === 0) {
      setNotice({ title: 'No files', message: 'All files are already being translated.' });
      return;
    }

    setNotice({
      title: 'Starting translations',
      message: `Starting translation for ${filesToTranslate.length} file(s)...`,
    });

    // Start all translations in parallel
    await Promise.all(filesToTranslate.map(({ index }) => handleTranslate(index)));
  };

  // Handle generating individual document with format selection
  const handleGenerateIndividualDocument = async (fileName: string) => {
    if (!selectedOrder || !user?.id || !translations) return;

    const translation = translations.find((t) => t.fileName === fileName);
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

    const approvedTranslations = translations.filter((t) => t.status === 'approved');
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
      approvedTranslations.map((t) => handleGenerateIndividualDocument(t.fileName))
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

      <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Orders</h3>
          <p className="text-sm text-gray-500 mt-1">
            {orders ? `${orders.length} order${orders.length !== 1 ? 's' : ''} total` : 'Loading...'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date of Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telephone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Translation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders === undefined ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">
                          {format(new Date(order.createdAt), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(order.createdAt), 'h:mm a')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${order.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.userName || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.userEmail || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.userTelephone || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="font-medium">{getLanguageName(order.sourceLanguage)}</span>
                        <span className="mx-2">→</span>
                        <span className="font-medium">{getLanguageName(order.targetLanguage)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.totalPages} {order.totalPages === 1 ? 'page' : 'pages'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order._id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          order.status === 'completed'
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : order.status === 'processing'
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : order.status === 'paid'
                            ? 'bg-purple-50 border-purple-200 text-purple-800'
                            : order.status === 'pending'
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
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
                        className="text-blue-600 hover:text-blue-900 font-medium"
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Order: {orderDetails.orderNumber}
          </h3>

          {/* Workflow Guidance */}
          {orderDetails.status === 'pending' ? (
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">
                <strong>Step 1 — Payment required.</strong> This order has been created, but the client hasn’t paid yet.
                Ask the client to pay from their dashboard. Once paid, set status to <strong>Processing</strong> and start translation.
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
          ) : null}

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
              <label className="block text-xs font-medium text-gray-700 mb-1">
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
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="e.g. anthropic/claude-3.5-sonnet"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Tip: paste any OpenRouter model ID (from your OpenRouter dashboard models list).
              </p>
            </div>
          )}

          {/* Original Files with Translate buttons */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900">Original Files:</h4>
              {orderDetails.status !== 'pending' && orderDetails.files.length > 1 && (
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
              {orderDetails.files.map((file, index) => {
                const isTranslating = translatingFileIndexes.has(index);
                const progress = translationProgress[index] || 0;
                // Handle case where translations query is still loading or failed
                const translation = translations === undefined ? undefined : translations.find((t) => t.fileName === file.fileName);
                const canTranslate = orderDetails.status !== 'pending';
                const showReviewButton =
                  canTranslate &&
                  !!translation &&
                  (translation.status === 'review' || translation.status === 'approved');

                // Always show a translate-style button when allowed (even if a translation already exists).
                // If a translation exists, it becomes "Retranslate".
                const showTranslateAction = canTranslate && !isTranslating;
                const translateActionLabel = translation ? 'Retranslate' : 'Translate';

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {file.pageCount} page{file.pageCount !== 1 ? 's' : ''} •{' '}
                        {getLanguageName(orderDetails.sourceLanguage)}
                      </p>
                      {isTranslating && (
                        <div className="mt-2 space-y-1">
                          <Progress value={progress} className="h-2" />
                          <p className="text-xs text-gray-600">Translating... {progress}%</p>
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
                        className="text-blue-600 hover:text-blue-800 text-sm"
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
          {translations && translations.filter((t) => t.status === 'approved').length > 0 && (
            <div className="mb-6 border border-green-200 rounded-lg p-4 bg-green-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">
                  Approved Translations ({translations.filter((t) => t.status === 'approved').length})
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const approvedFileNames = translations
                        .filter((t) => t.status === 'approved')
                        .map((t) => t.fileName);
                      if (selectedForCombine.size === approvedFileNames.length) {
                        setSelectedForCombine(new Set());
                      } else {
                        setSelectedForCombine(new Set(approvedFileNames));
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {selectedForCombine.size === translations.filter((t) => t.status === 'approved').length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Format Selection */}
              <div className="mb-4 p-3 bg-white rounded-md border border-gray-200">
                <label className="block text-xs font-medium text-gray-700 mb-2">
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
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Word (.docx)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportFormat"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={() => setExportFormat('pdf')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">PDF (.pdf)</span>
                  </label>
                </div>
              </div>

              {/* Approved Files List with Checkboxes */}
              <div className="space-y-2 mb-4">
                {translations
                  .filter((t) => t.status === 'approved')
                  .map((translation) => (
                    <div
                      key={translation._id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100"
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
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{translation.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {translation.segments.length} segment(s) •{' '}
                            {getLanguageName(translation.targetLanguage)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs text-green-600 font-medium block">✓ Approved</span>
                          {translation.approvedAt && (
                            <span className="text-xs text-gray-500 block">
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Combined Download Actions */}
              <div className="flex items-center gap-3 pt-3 border-t border-green-200">
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
                  disabled={isGeneratingCombined || translations.filter((t) => t.status === 'approved').length === 0}
                >
                  Download All Separately
                </Button>
              </div>
            </div>
          )}

          {/* Translated Files (if uploaded) */}
          {orderDetails.translatedFiles && orderDetails.translatedFiles.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-2">Translated Files:</h4>
              <div className="space-y-2">
                {orderDetails.translatedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                      <p className="text-xs text-gray-500">
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
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Download
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTranslatedFile(file.fileName)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
              <h4 className="font-medium text-gray-900 mb-4">
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
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {translatedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">Selected files:</p>
                    {translatedFiles.map((file, index) => (
                      <p key={index} className="text-sm text-gray-600">
                        • {file.name}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleUploadTranslations}
                  disabled={orderDetails.status === 'pending' || translatedFiles.length === 0 || isUploading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload Translations'}
                </button>
              </div>
            </div>
          )}

          {/* Translation Review Modal */}
          {reviewingFileIndex !== null && orderDetails && (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto p-6">
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

