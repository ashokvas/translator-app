'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { format } from 'date-fns';
import { getLanguageName } from '@/lib/languages';
import { Id } from '@/convex/_generated/dataModel';
import type { Doc } from '@/convex/_generated/dataModel';
import { TranslationReview } from './translation-review';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// Extended order type with user information
type OrderWithUser = Doc<'orders'> & {
  userEmail?: string;
  userName?: string | null;
  userTelephone?: string | null;
};

export function OrderManagement() {
  const { user } = useUser();
  const orders = useQuery(
    api.orders.getAllOrders,
    user?.id ? { clerkId: user.id } : 'skip'
  ) as OrderWithUser[] | undefined;
  const [selectedOrder, setSelectedOrder] = useState<Id<'orders'> | null>(null);
  const [translatedFiles, setTranslatedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [translatingFileIndex, setTranslatingFileIndex] = useState<number | null>(null);
  const [reviewingFileIndex, setReviewingFileIndex] = useState<number | null>(null);
  const [translationProgress, setTranslationProgress] = useState<Record<number, number>>({});

  const orderDetails = useQuery(
    api.orders.getOrderWithFiles,
    selectedOrder && user?.id
      ? { orderId: selectedOrder, clerkId: user.id }
      : 'skip'
  );

  const uploadTranslatedFiles = useMutation(api.orders.uploadTranslatedFiles);
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);
  const updateTranslationProgress = useMutation(api.translations.updateTranslationProgress);

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

        // Stop translating if status changed to review or approved
        if (
          translation.status === 'review' ||
          translation.status === 'approved'
        ) {
          setTranslatingFileIndex((prev) =>
            prev === fileIndex ? null : prev
          );
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
      alert('Please select translated files to upload');
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

      alert('Translated files uploaded successfully!');
      setTranslatedFiles([]);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload translations: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranslate = async (fileIndex: number) => {
    if (!selectedOrder || !user?.id || !orderDetails) return;

    const file = orderDetails.files[fileIndex];
    setTranslatingFileIndex(fileIndex);
    setTranslationProgress((prev) => ({ ...prev, [fileIndex]: 0 }));

    try {
      // Update progress to translating
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder,
          fileName: file.fileName,
          fileIndex,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          sourceLanguage: orderDetails.sourceLanguage,
          targetLanguage: orderDetails.targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Translation failed');
      }

      // The translations query will automatically update via Convex subscription
      // We'll monitor it via useEffect instead of polling
      alert('Translation started! The progress will update automatically.');
    } catch (error) {
      console.error('Translation error:', error);
      alert(`Translation failed: ${error instanceof Error ? error.message : String(error)}`);
      setTranslatingFileIndex(null);
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
      alert('Order status updated successfully!');
    } catch (error) {
      console.error('Status update error:', error);
      alert(`Failed to update status: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="space-y-6">
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

          {/* Original Files with Translate buttons */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Original Files:</h4>
            <div className="space-y-2">
              {orderDetails.files.map((file, index) => {
                const isTranslating = translatingFileIndex === index;
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
                      {translation && translation.status === 'review' && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Translation ready for review
                        </p>
                      )}
                      {translation && translation.status === 'approved' && (
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
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {getLanguageName(orderDetails.targetLanguage)}
                      </p>
                    </div>
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Download
                    </a>
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

