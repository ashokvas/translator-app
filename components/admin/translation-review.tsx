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
        alert(`Failed to save: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [user?.id, translation, localEdits, updateSegment]
  );

  const handleApprove = useCallback(async () => {
    if (!user?.id || !translation) return;

    const confirmed = confirm(
      'This will approve the translation and generate a Word document with all translated pages. Continue?'
    );
    if (!confirmed) return;

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to generate document');
      }

      const result = await response.json();
      
      alert(`Translation approved and document generated!\nFile: ${result.fileName}`);
      onApprove();
    } catch (error) {
      console.error('Failed to approve translation:', error);
      alert(`Failed to approve: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [user?.id, translation, approveTranslation, onApprove, orderId, fileName]);

  const handleRetranslate = useCallback(async () => {
    if (!user?.id) return;

    // Call translation API again - we'll get file details from props or parent component
    try {
      // Call translate API - it will fetch fileUrl/fileType from Convex if not provided
      const response = await fetch('/api/translate', {
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Retranslation failed');
      }

      // Translation will be updated via Convex subscription
      alert('Retranslation started. Please wait...');
    } catch (error) {
      console.error('Retranslation error:', error);
      alert(`Failed to retranslate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [user?.id, orderId, fileName, fileIndex, sourceLanguage, targetLanguage]);

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
                      <div className="p-3 bg-gray-50 rounded-md border border-gray-200 min-h-[100px]">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">
                          {segment.originalText}
                        </p>
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
                            className={`p-3 rounded-md border min-h-[100px] cursor-text ${
                              hasChanges
                                ? 'bg-yellow-50 border-yellow-300'
                                : 'bg-white border-gray-200'
                            }`}
                            onClick={() => setEditingSegmentId(segment.id)}
                          >
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">
                              {editedText}
                            </p>
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Review and edit translations above, then approve when ready.
                </p>
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

