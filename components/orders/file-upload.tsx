'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  storageId?: string; // Convex storage ID (optional for backward compatibility)
  fileSize: number;
  pageCount: number;
  fileType: string;
  pageCountSource?: 'exact' | 'estimated';
}

interface FileUploadProps {
  onFilesUploaded: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  uploadedFiles: UploadedFile[];
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
  previewUrl?: string;
  uploaded?: UploadedFile;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewableImage(type: string) {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
}

function fileTypeLabel(type: string) {
  if (type === 'application/pdf') return 'PDF';
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX';
  if (type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'XLSX';
  if (type.startsWith('image/')) return type.replace('image/', '').toUpperCase();
  return type;
}

async function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ files: UploadedFile[] }> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json);
        } else {
          reject(new Error(json?.details || json?.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while uploading'));

    const formData = new FormData();
    formData.append('files', file);
    xhr.send(formData);
  });
}

export function FileUpload({ onFilesUploaded, uploadedFiles }: FileUploadProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [preview, setPreview] = useState<UploadItem | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        const queued: UploadItem[] = acceptedFiles.map((file) => {
          const tooLarge = file.size > MAX_FILE_SIZE_BYTES;
          const previewUrl = isPreviewableImage(file.type) ? URL.createObjectURL(file) : undefined;
          return {
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
            file,
            progress: 0,
            status: tooLarge ? 'error' : 'queued',
            error: tooLarge ? 'File exceeds 10MB limit' : undefined,
            previewUrl,
          };
        });

        setItems((prev) => [...queued, ...prev]);

        // Upload concurrently
        await Promise.all(
          queued.map(async (it) => {
            if (it.status === 'error') return;
            setItems((prev) =>
              prev.map((p) => (p.id === it.id ? { ...p, status: 'uploading', progress: 0 } : p))
            );

            try {
              const result = await uploadWithProgress(it.file, (pct) => {
                setItems((prev) =>
                  prev.map((p) => (p.id === it.id ? { ...p, progress: pct } : p))
                );
              });

              const uploaded = result.files?.[0];
              if (!uploaded) throw new Error('Upload succeeded but no file metadata returned');

              const normalized: UploadedFile = {
                ...uploaded,
                pageCountSource: 'exact',
              };

              setItems((prev) =>
                prev.map((p) =>
                  p.id === it.id ? { ...p, status: 'done', progress: 100, uploaded: normalized } : p
                )
              );

              onFilesUploaded((prev) => [...prev, normalized]);

              // Remove from queue after a short delay so user can see "done" state
              setTimeout(() => {
                setItems((prev) => {
                  const filtered = prev.filter((p) => p.id !== it.id);
                  // Clean up preview URL to prevent memory leaks
                  if (it.previewUrl) {
                    URL.revokeObjectURL(it.previewUrl);
                  }
                  return filtered;
                });
              }, 1500);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              setItems((prev) =>
                prev.map((p) =>
                  p.id === it.id ? { ...p, status: 'error', error: message, progress: 0 } : p
                )
              );
            }
          })
        );
      } catch (error) {
        console.error('Upload error:', error);
        setNotice({
          title: 'Upload failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [onFilesUploaded, uploadedFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    onFilesUploaded((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
      <Card
        {...getRootProps()}
        className={`cursor-pointer border-dashed transition-colors ${
          isDragActive ? 'border-primary bg-muted/40' : 'hover:border-border/70'
        }`}
      >
        <input {...getInputProps()} />
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M8 16l4-4m0 0l4 4m-4-4v10"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              Drag & drop files here, or click to select
            </div>
            <div className="text-xs text-muted-foreground">
              PDF, JPEG, PNG, WebP, DOCX, XLSX • Max 10MB per file
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload queue */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">Upload queue</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <Card key={it.id} className="overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setPreview(it)}
                >
                  <CardHeader>
                    <CardTitle className="truncate">{it.file.name}</CardTitle>
                    <CardDescription className="flex items-center justify-between">
                      <span>
                        {fileTypeLabel(it.file.type)} • {formatFileSize(it.file.size)}
                      </span>
                      <span
                        className={
                          it.status === 'done'
                            ? 'text-green-600'
                            : it.status === 'error'
                            ? 'text-red-600'
                            : it.status === 'uploading'
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }
                      >
                        {it.status}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
                        {it.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.previewUrl}
                            alt={it.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                            {fileTypeLabel(it.file.type)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Progress value={it.progress} />
                        <div className="mt-1 text-xs text-muted-foreground">
                          {it.status === 'done' && it.uploaded ? (
                            <>
                              {it.uploaded.pageCount} page{it.uploaded.pageCount !== 1 ? 's' : ''} • $
                              {(it.uploaded.pageCount * 35).toFixed(2)}
                            </>
                          ) : it.status === 'error' ? (
                            <span className="text-red-600">{it.error}</span>
                          ) : (
                            <span>Uploading…</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">Uploaded Files ({uploadedFiles.length})</h3>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)} • {file.pageCount} page
                    {file.pageCount !== 1 ? 's' : ''} • ${(file.pageCount * 35).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-4 text-red-600 hover:text-red-500"
                  type="button"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={preview?.file.name}
      >
        {preview ? (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {fileTypeLabel(preview.file.type)} • {formatFileSize(preview.file.size)}
              {preview.uploaded ? (
                <>
                  {' '}
                  • {preview.uploaded.pageCount} page
                  {preview.uploaded.pageCount !== 1 ? 's' : ''}
                </>
              ) : null}
            </div>
            {preview.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.previewUrl}
                alt={preview.file.name}
                className="max-h-[60vh] w-full rounded-lg object-contain bg-muted/40"
              />
            ) : preview.file.type === 'application/pdf' && preview.uploaded?.fileUrl ? (
              <iframe
                src={preview.uploaded.fileUrl}
                className="h-[60vh] w-full rounded-lg border border-border bg-background"
                title="PDF preview"
              />
            ) : (
              <div className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                Preview not available for this file type.
              </div>
            )}
          </div>
        ) : (
          <div />
        )}
      </Dialog>
    </div>
  );
}

