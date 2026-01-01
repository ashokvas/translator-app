'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FileUpload } from '../orders/file-upload';
import { AUTO_DETECT_LANGUAGE, LANGUAGES, getLanguageLabel, getLanguageName } from '@/lib/languages';
import { Id } from '@/convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
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

export function AdminOrderForm() {
  const { user } = useUser();
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState<string>(AUTO_DETECT_LANGUAGE.code);
  const [targetLanguage, setTargetLanguage] = useState<string>('es');
  const [ocrQuality, setOcrQuality] = useState<OcrQuality>('high');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientEmail, setNewClientEmail] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const createOrder = useMutation(api.orders.createOrder);
  const createClientUser = useMutation(api.users.createClientUser);
  
  // Get all users for client selection
  const allUsers = useQuery(
    api.users.getAllUsers,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  const totalPages = uploadedFiles.reduce((sum, file) => sum + file.pageCount, 0);
  const totalAmount = totalPages * PRICE_PER_PAGE;

  const handleCreateNewClient = async () => {
    if (!user?.id) {
      setNotice({ title: 'Sign in required', message: 'Please sign in to create a client.' });
      return;
    }

    if (!newClientEmail.trim()) {
      setNotice({ title: 'Missing email', message: 'Please enter client email.' });
      return;
    }

    setIsCreatingClient(true);
    try {
      const result = await createClientUser({
        email: newClientEmail.trim(),
        name: newClientName.trim() || undefined,
        telephone: newClientPhone.trim() || undefined,
        adminClerkId: user.id,
      });

      // Set the newly created client as selected
      setSelectedClientId(result.clerkId);
      setShowNewClientForm(false);
      
      // Reset form
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');

      setNotice({ title: 'Client created', message: 'Client created successfully.' });
    } catch (error) {
      console.error('Failed to create client:', error);
      setNotice({
        title: 'Create client failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!user?.id) {
      setNotice({ title: 'Sign in required', message: 'Please sign in to create an order.' });
      return;
    }

    if (!selectedClientId) {
      setNotice({ title: 'Missing client', message: 'Please select a client for this order.' });
      return;
    }

    if (uploadedFiles.length === 0) {
      setNotice({ title: 'No files', message: 'Please upload at least one file.' });
      return;
    }

    if (!sourceLanguage || !targetLanguage) {
      setNotice({ title: 'Missing languages', message: 'Please select both source and target languages.' });
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setNotice({ title: 'Invalid languages', message: 'Source and target languages must be different.' });
      return;
    }

    setIsCreating(true);
    try {
      // Convert files to match the expected format
      const filesForOrder = uploadedFiles.map((file) => ({
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        storageId: file.storageId ? (file.storageId as any as Id<'_storage'>) : undefined,
        fileSize: file.fileSize,
        pageCount: file.pageCount,
        fileType: file.fileType,
      }));

      // Create order for the selected client (not the admin)
      const result = await createOrder({
        clerkId: selectedClientId, // Use selected client's ID, not admin's ID
        files: filesForOrder,
        totalPages,
        amount: totalAmount,
        sourceLanguage,
        targetLanguage,
        ocrQuality,
      });

      // Send order created email to client
      const clientUser = allUsers?.find((u) => u.clerkId === selectedClientId);
      const clientEmail = clientUser?.email;
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
          email: clientEmail,
          customerName: clientUser?.name || undefined,
        }),
      });

      setNotice({
        title: 'Order created',
        message: 'Order created successfully. Client has been notified that payment is required.',
      });
      
      // Reset form
      setUploadedFiles([]);
      setSourceLanguage('en');
      setTargetLanguage('es');
      setSelectedClientId('');
      
      // Redirect to orders tab
      router.push('/admin');
    } catch (error) {
      console.error('Failed to create order:', error);
      setNotice({ title: 'Create order failed', message: 'Failed to create order. Please try again.' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
      {/* Client Selection Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Select Client
        </h2>
        <div className="space-y-4">
          {!showNewClientForm ? (
            <>
              <div>
                <label
                  htmlFor="client-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Client for this order
                </label>
                <select
                  id="client-select"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select a client --</option>
                  {allUsers
                    ?.filter((u) => u.role === 'user') // Only show regular users, not admins
                    .map((client) => (
                      <option key={client.clerkId} value={client.clerkId}>
                        {client.name || client.email} {client.email && client.name ? `(${client.email})` : ''}
                      </option>
                    ))}
                </select>
                {selectedClientId && (
                  <p className="mt-2 text-sm text-gray-600">
                    Order will be created for:{' '}
                    <strong>
                      {allUsers?.find((u) => u.clerkId === selectedClientId)?.name ||
                        allUsers?.find((u) => u.clerkId === selectedClientId)?.email ||
                        'Selected client'}
                    </strong>
                  </p>
                )}
              </div>
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Create New Client
                </button>
              </div>
            </>
          ) : (
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Create New Client
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="new-client-email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="new-client-email"
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-client-name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Name
                  </label>
                  <input
                    id="new-client-name"
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Client Name"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-client-phone"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    id="new-client-phone"
                    type="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateNewClient}
                    disabled={isCreatingClient || !newClientEmail.trim()}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingClient ? 'Creating...' : 'Create Client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewClientForm(false);
                      setNewClientName('');
                      setNewClientEmail('');
                      setNewClientPhone('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Document Quality Section */}
      {uploadedFiles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Document Quality
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Select the quality of the uploaded documents. This helps optimize text extraction for scanned or photographed documents.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OCR_QUALITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setOcrQuality(option.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  ocrQuality === option.value
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{option.icon}</span>
                  <span className={`font-semibold ${
                    ocrQuality === option.value ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {option.label}
                  </span>
                  {ocrQuality === option.value && (
                    <span className="ml-auto">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className={`text-sm ${
                  ocrQuality === option.value ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {option.description}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>💡 Tip:</strong> If documents are scanned, photographed, or have poor image quality, select &quot;High Quality&quot; for better text recognition accuracy.
            </p>
          </div>
        </div>
      )}

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
              <span className="text-gray-600">Document quality:</span>
              <span className="font-medium">
                {ocrQuality === 'high' ? '✨ High Quality' : '⚡ Standard Quality'}
              </span>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-800">
                <strong>Admin Note:</strong> This order will be created without taking payment. The client can pay later from their dashboard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Button (No Payment Required) */}
      {uploadedFiles.length > 0 && (
        <div className="border-t pt-6">
          <button
            onClick={handleCreateOrder}
            disabled={isCreating || sourceLanguage === targetLanguage || !selectedClientId}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating Order...' : 'Create Order (No Payment Required)'}
          </button>
          {!selectedClientId && (
            <p className="mt-2 text-sm text-red-600 text-center">
              Please select a client before creating the order
            </p>
          )}
        </div>
      )}
    </div>
  );
}

