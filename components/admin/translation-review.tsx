'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { Id } from '@/convex/_generated/dataModel';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLanguageName } from '@/lib/languages';
import { Select, SelectItem } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import {
  DOCUMENT_DOMAINS,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_MODEL_PRESETS,
  TRANSLATION_PROVIDERS,
  type DocumentDomain,
  type TranslationProvider,
} from '@/lib/translation-providers';
import { MarkdownTableRenderer } from '@/components/ui/markdown-table-renderer';

interface TranslationReviewProps {
  orderId: Id<'orders'>;
  fileName: string;
  fileIndex: number;
  fileUrl?: string;
  fileType?: string;
  sourceLanguage: string;
  targetLanguage: string;
  onClose: () => void;
  onApprove: () => void;
}

export function TranslationReview({
  orderId,
  fileName,
  fileIndex,
  fileUrl,
  fileType,
  sourceLanguage,
  targetLanguage,
  onClose,
  onApprove,
}: TranslationReviewProps) {
  const { user } = useUser();
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>('google');
  const [documentDomain, setDocumentDomain] = useState<DocumentDomain>('general');
  const [openRouterModel, setOpenRouterModel] = useState<string>(OPENROUTER_DEFAULT_MODEL);
  const [ocrQuality, setOcrQuality] = useState<'high' | 'low'>('high');
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const translation = useQuery(
    api.translations.getTranslationByFile,
    user?.id
      ? {
          orderId,
          fileName,
          clerkId: user.id,
        }
      : 'skip'
  );

  const updateSegment = useMutation(api.translations.updateTranslationSegment);
  const approveTranslation = useMutation(api.translations.approveTranslation);

  // Initialize local edits from translation data
  useEffect(() => {
    if (translation?.segments) {
      const edits: Record<string, string> = {};
      translation.segments.forEach((seg) => {
        edits[seg.id] = seg.translatedText;
      });
      setLocalEdits(edits);
    }
  }, [translation]);

  // Initialize provider/domain selection from stored translation metadata (if present)
  useEffect(() => {
    if (!translation) return;
    if (translation.translationProvider) {
      setTranslationProvider(translation.translationProvider as TranslationProvider);
    }
    if (translation.documentDomain) {
      setDocumentDomain(translation.documentDomain as DocumentDomain);
    }
    if ((translation as any).openRouterModel) {
      setOpenRouterModel(String((translation as any).openRouterModel));
    }
    if ((translation as any).ocrQuality === 'low' || (translation as any).ocrQuality === 'high') {
      setOcrQuality((translation as any).ocrQuality);
    }
  }, [translation]);

  const handleSegmentChange = useCallback(
    (segmentId: string, newText: string) => {
      setLocalEdits((prev) => ({ ...prev, [segmentId]: newText }));
    },
    []
  );

  const handleSaveSegment = useCallback(
    async (segmentId: string) => {
      if (!user?.id || !translation) return;

      const editedText = localEdits[segmentId];
      if (!editedText) return;

      try {
        await updateSegment({
          translationId: translation._id,
          segmentId,
          translatedText: editedText,
          clerkId: user.id,
        });
        setEditingSegmentId(null);
      } catch (error) {
        console.error('Failed to save segment:', error);
        setNotice({
          title: 'Save failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [user?.id, translation, localEdits, updateSegment]
  );

  const handleApprove = useCallback(async () => {
    if (!user?.id || !translation) return;
    setIsApproveDialogOpen(true);
  }, [user?.id, translation]);

  const handleConfirmApprove = useCallback(async () => {
    if (!user?.id || !translation) return;

    try {
      // Step 1: Approve the translation
      await approveTranslation({
        translationId: translation._id,
        clerkId: user.id,
      });

      // Step 2: Generate Word document
      const response = await fetch('/api/generate-translated-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translationId: translation._id,
          orderId,
          fileName,
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
          errorData?.error ||
            errorData?.details ||
            errorText ||
            `Failed to generate document (HTTP ${response.status})`
        );
      }

      const result = await response.json();

      setNotice({
        title: 'Approved',
        message: `Translation approved and document generated.\nFile: ${result.fileName}`,
      });
      onApprove();
    } catch (error) {
      console.error('Failed to approve translation:', error);
      setNotice({
        title: 'Approval failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsApproveDialogOpen(false);
    }
  }, [user?.id, translation, approveTranslation, onApprove, orderId, fileName]);

  const handleRetranslate = useCallback(async () => {
    if (!user?.id) return;

    // Call translation API again - we'll get file details from props or parent component
    try {
      // Call translate API - it will fetch fileUrl/fileType from Convex if not provided
      // Use API subdomain if configured (bypasses Cloudflare 100s timeout limit)
      // Temporarily hardcoded - will use env var once confirmed working
      const apiBase = 'https://api.translatoraxis.com';
      const response = await fetch(`${apiBase}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          fileName,
          fileIndex,
          fileUrl: fileUrl || '', // API will fetch from Convex if empty
          fileType: fileType || '', // API will fetch from Convex if empty
          sourceLanguage,
          targetLanguage,
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
            `Retranslation failed (HTTP ${response.status})`
        );
      }

      // Translation will be updated via Convex subscription
      setNotice({
        title: 'Retranslation started',
        message: 'Retranslation started. Please wait…',
      });
    } catch (error) {
      console.error('Retranslation error:', error);
      setNotice({
        title: 'Retranslation failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    user?.id,
    orderId,
    fileName,
    fileIndex,
    sourceLanguage,
    targetLanguage,
    translationProvider,
    documentDomain,
    openRouterModel,
    ocrQuality,
  ]);

  if (!translation) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Loading translation...</p>
          <Progress value={0} />
        </div>
      </div>
    );
  }

  const isApproved = translation.status === 'approved';
  const isReviewing = translation.status === 'review';
  const editedCount = translation.segments.filter((s) => s.isEdited).length;

  return (
    <div className="space-y-6">
      <Dialog
        open={isApproveDialogOpen}
        onOpenChange={setIsApproveDialogOpen}
        title="Approve translation?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This will approve the translation and generate a Word document with all translated
            pages.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleConfirmApprove}>
              Approve & Generate
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!notice} onOpenChange={(open) => !open && setNotice(null)} title={notice?.title}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{notice?.message}</p>
          <div className="flex justify-end">
            <Button onClick={() => setNotice(null)}>Close</Button>
          </div>
        </div>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{fileName}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {getLanguageName(sourceLanguage)} → {getLanguageName(targetLanguage)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editedCount > 0 && (
            <Badge variant="secondary">{editedCount} edited</Badge>
          )}
          {isApproved && <Badge variant="default">Approved</Badge>}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Progress */}
      {translation.status === 'translating' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Translation in progress...</span>
                <span>{translation.progress}%</span>
              </div>
              <Progress value={translation.progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Translation Segments */}
      {translation.segments.length > 0 && (
        <div className="space-y-4">
          {translation.segments.map((segment, index) => {
            const isEditing = editingSegmentId === segment.id;
            const editedText = localEdits[segment.id] || segment.translatedText;
            const hasChanges = editedText !== segment.translatedText;

            return (
              <Card
                key={segment.id}
                className={segment.isEdited ? 'border-blue-300 bg-blue-50' : ''}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Segment {index + 1}
                      {segment.pageNumber && (
                        <span className="text-gray-500 ml-2">
                          (Page {segment.pageNumber})
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {segment.isEdited && (
                        <Badge variant="secondary" className="text-xs">
                          Edited
                        </Badge>
                      )}
                      {hasChanges && !isEditing && (
                        <Badge variant="outline" className="text-xs text-yellow-700">
                          Unsaved
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Original Text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Original ({getLanguageName(sourceLanguage)})
                      </label>
                      <div className="p-3 bg-gray-50 rounded-md border border-gray-200 min-h-[100px] overflow-auto">
                        <MarkdownTableRenderer text={segment.originalText} />
                      </div>
                    </div>

                    {/* Translated Text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Translation ({getLanguageName(targetLanguage)})
                      </label>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedText}
                            onChange={(e) =>
                              handleSegmentChange(segment.id, e.target.value)
                            }
                            className="min-h-[100px] bg-white"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveSegment(segment.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingSegmentId(null);
                                setLocalEdits((prev) => ({
                                  ...prev,
                                  [segment.id]: segment.translatedText,
                                }));
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div
                            className={`p-3 rounded-md border min-h-[100px] cursor-text overflow-auto ${
                              hasChanges
                                ? 'bg-yellow-50 border-yellow-300'
                                : 'bg-white border-gray-200'
                            }`}
                            onClick={() => setEditingSegmentId(segment.id)}
                          >
                            <MarkdownTableRenderer text={editedText} />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingSegmentId(segment.id)}
                            >
                              Edit
                            </Button>
                            {hasChanges && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleSaveSegment(segment.id)}
                              >
                                Save Changes
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Actions */}
      {isReviewing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Review and edit translations above, then approve when ready.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      Tip: for latest models, use OpenRouter. Google is a fallback.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Domain
                    </label>
                    <Select value={documentDomain} onValueChange={(v) => setDocumentDomain(v as DocumentDomain)}>
                      {DOCUMENT_DOMAINS.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    OCR quality
                  </label>
                  <Select value={ocrQuality} onValueChange={(v) => setOcrQuality(v as 'high' | 'low')}>
                    <SelectItem value="high">High (recommended for scans)</SelectItem>
                    <SelectItem value="low">Low (faster / cleaner simple images)</SelectItem>
                  </Select>
                </div>
                {translationProvider === 'openrouter' && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        OpenRouter model
                      </label>
                      <Select value={openRouterModel} onValueChange={setOpenRouterModel}>
                        {OPENROUTER_MODEL_PRESETS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="sm:pt-6">
                      <input
                        value={openRouterModel}
                        onChange={(e) => setOpenRouterModel(e.target.value)}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                        placeholder="e.g. anthropic/claude-3.5-sonnet"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleRetranslate}>
                  Retranslate All
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={!isReviewing}
                >
                  Approve Translation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

