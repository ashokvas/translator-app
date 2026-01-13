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
import { Textarea } from '@/components/ui/textarea';
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
type ServiceType = 'certified' | 'general' | 'custom';
type DocumentDomain = 'general' | 'certificate' | 'legal' | 'medical' | 'technical';

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

const DOCUMENT_DOMAINS: Array<{ value: DocumentDomain; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'certificate', label: 'Certificate/Official' },
  { value: 'legal', label: 'Legal' },
  { value: 'medical', label: 'Medical' },
  { value: 'technical', label: 'Technical' },
];

export function AdminOrderForm() {
  const { user } = useUser();
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType>('general');
  const [isRush, setIsRush] = useState(false);
  const [documentDomain, setDocumentDomain] = useState<DocumentDomain>('general');
  const [remarks, setRemarks] = useState<string>('');
  const [sourceLanguage, setSourceLanguage] = useState<string>(AUTO_DETECT_LANGUAGE.code);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
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
  const pricing = useQuery(api.settings.getPricing);
  
  // Get all users for client selection
  const allUsers = useQuery(
    api.users.getAllUsers,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  const totalPages = uploadedFiles.reduce((sum, file) => sum + file.pageCount, 0);

  // Calculate amount based on service type and pricing
  const calculateAmount = () => {
    if (serviceType === 'custom') return 0;
    if (!pricing) return 0;

    const serviceConfig = serviceType === 'certified' ? pricing.certified : pricing.general;
    const baseRate = serviceConfig.basePerPage;
    const rushExtra = isRush ? serviceConfig.rushExtraPerPage : 0;
    return totalPages * (baseRate + rushExtra);
  };

  const totalAmount = calculateAmount();

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
        serviceType,
        isRush,
        documentDomain,
        remarks: remarks.trim() || undefined,
        files: filesForOrder,
        totalPages,
        amount: totalAmount,
        sourceLanguage,
        targetLanguage,
        ocrQuality,
      });

      // Send order created email to client
      const clientUser = allUsers?.find((u: any) => u.clerkId === selectedClientId);
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
      setServiceType('general');
      setIsRush(false);
      setDocumentDomain('general');
      setRemarks('');
      setSourceLanguage(AUTO_DETECT_LANGUAGE.code);
      setTargetLanguage('en');
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
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6 space-y-6">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
      {/* Client Selection Section */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Select Client
        </h2>
        <div className="space-y-4">
          {!showNewClientForm ? (
            <>
              <div>
                <label
                  htmlFor="client-select"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Client for this order
                </label>
                <select
                  id="client-select"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">-- Select a client --</option>
                  {allUsers
                    ?.filter((u: any) => u.role === 'user') // Only show regular users, not admins
                    .map((client: any) => (
                      <option key={client.clerkId} value={client.clerkId}>
                        {client.name || client.email} {client.email && client.name ? `(${client.email})` : ''}
                      </option>
                    ))}
                </select>
                {selectedClientId && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Order will be created for:{' '}
                    <strong>
                      {allUsers?.find((u: any) => u.clerkId === selectedClientId)?.name ||
                        allUsers?.find((u: any) => u.clerkId === selectedClientId)?.email ||
                        'Selected client'}
                    </strong>
                  </p>
                )}
              </div>
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(true)}
                  className="text-primary hover:opacity-90 text-sm font-medium"
                >
                  + Create New Client
                </button>
              </div>
            </>
          ) : (
            <div className="border border-border rounded-lg p-4 bg-muted/40">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Create New Client
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="new-client-email"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="new-client-email"
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-client-name"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Name
                  </label>
                  <input
                    id="new-client-name"
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Client Name"
                    className="w-full border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-client-phone"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Phone Number
                  </label>
                  <input
                    id="new-client-phone"
                    type="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full border border-border bg-background text-foreground rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCreateNewClient}
                    disabled={isCreatingClient || !newClientEmail.trim()}
                    className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex-1 bg-muted text-foreground px-4 py-2 rounded-lg font-medium hover:bg-muted/70 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Service Type Selection */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Service Type</h2>
        <Select id="service-type" value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
          <SelectItem value="general">General Translation</SelectItem>
          <SelectItem value="certified">Certified Translation</SelectItem>
          <SelectItem value="custom">Custom Translation</SelectItem>
        </Select>
        <p className="mt-2 text-sm text-muted-foreground">
          Select the type of translation service for this order.
        </p>
      </div>

      {/* Document Domain */}
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
          Select the document type for optimal translation quality.
        </p>
      </div>

      {/* Rush Service */}
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
                ? 'Mark this order as rush for priority processing.'
                : pricing
                ? `Additional $${
                    serviceType === 'certified' ? pricing.certified.rushExtraPerPage : pricing.general.rushExtraPerPage
                  } per page`
                : 'Loading pricing...'}
            </p>
          </div>
        </label>
      </div>

      {/* Language Selection Section */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Translation Languages
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="source-language"
              className="block text-sm font-medium text-foreground mb-2"
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
          </div>
        </div>
        {sourceLanguage && targetLanguage && (
          <p className="mt-3 text-sm text-muted-foreground">
            Translating from <strong>{getLanguageName(sourceLanguage)}</strong> to{' '}
            <strong>{getLanguageName(targetLanguage)}</strong>
          </p>
        )}
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

      {/* Special Instructions */}
      {uploadedFiles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Special Instructions (Optional)</h2>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter any special instructions or requirements for this order..."
            rows={3}
            className="w-full"
          />
        </div>
      )}

      {/* Document Quality Section */}
      {uploadedFiles.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Document Quality
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
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
              <strong>💡 Tip:</strong> If documents are scanned, photographed, or have poor image quality, select &quot;High Quality&quot; for better text recognition accuracy.
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
              <span className="text-muted-foreground">Service Type:</span>
              <span className="font-medium text-foreground capitalize">{serviceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Translation:</span>
              <span className="font-medium text-foreground">
                {getLanguageName(sourceLanguage)} → {getLanguageName(targetLanguage)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Document Type:</span>
              <span className="font-medium text-foreground">
                {DOCUMENT_DOMAINS.find((d) => d.value === documentDomain)?.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery:</span>
              <span className="font-medium text-foreground">{isRush ? '24 hours (Rush)' : '7 days (Standard)'}</span>
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
                    Calculation: {totalPages} page{totalPages !== 1 ? 's' : ''} × ${(totalAmount / totalPages).toFixed(2)} = ${totalAmount.toFixed(2)}
                  </div>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            {serviceType === 'custom' && (
              <div className="bg-muted/40 border border-border rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Custom Order:</strong> This order will be created as quote-pending. Set the quote amount in Order Management after reviewing requirements.
                </p>
              </div>
            )}
            <div className="bg-muted/40 border border-border rounded-lg p-3 mt-4">
              <p className="text-sm text-muted-foreground">
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

