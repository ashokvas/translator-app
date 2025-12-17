import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Buffer } from 'buffer';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for translation

/**
 * POST /api/translate
 * Translates a file using Google Cloud Translation API
 * 
 * Body: {
 *   orderId: string,
 *   fileName: string,
 *   fileIndex: number,
 *   fileUrl: string,
 *   fileType: string,
 *   sourceLanguage: string,
 *   targetLanguage: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const authResult = await auth();
    const userId = authResult?.userId;
    const getToken = authResult?.getToken;

    if (!userId || !getToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role via Convex
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: 'Convex not configured' }, { status: 500 });
    }

    const convexClient = new ConvexHttpClient(convexUrl);
    const userRole = await convexClient.query(api.users.getCurrentUserRole, {
      clerkId: userId,
    });

    if (userRole?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    let {
      orderId,
      fileName,
      fileIndex,
      fileUrl,
      fileType,
      sourceLanguage,
      targetLanguage,
    } = body;

    if (!orderId || !fileName || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If fileUrl or fileType not provided, fetch from Convex
    if (!fileUrl || !fileType) {
      const order = await convexClient.query(api.orders.getOrderWithFiles, {
        orderId: orderId as any,
        clerkId: userId,
      });

      if (!order || !order.files || !order.files[fileIndex]) {
        return NextResponse.json(
          { error: 'Order or file not found' },
          { status: 404 }
        );
      }

      const file = order.files[fileIndex];
      fileUrl = fileUrl || file.fileUrl;
      fileType = fileType || file.fileType;
      sourceLanguage = sourceLanguage || order.sourceLanguage;
      targetLanguage = targetLanguage || order.targetLanguage;
    }

    // Check if Google Cloud credentials are configured
    const googleApiKey = process.env.GOOGLE_CLOUD_API_KEY;
    const googleProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!googleApiKey || !googleProjectId) {
      return NextResponse.json(
        {
          error: 'Google Cloud Translation API not configured',
          details: 'Please set GOOGLE_CLOUD_API_KEY and GOOGLE_CLOUD_PROJECT_ID in .env.local',
        },
        { status: 500 }
      );
    }

    // Initialize translation progress
    const translationId = await convexClient.mutation(api.translations.upsertTranslation, {
      orderId: orderId as any,
      fileName,
      fileIndex,
      segments: [],
      status: 'translating',
      progress: 0,
      sourceLanguage,
      targetLanguage,
      clerkId: userId,
    });

    try {
      let segments: Array<{
        id: string;
        originalText: string;
        translatedText: string;
        isEdited: boolean;
        pageNumber?: number;
        order: number;
      }> = [];

      if (fileType.startsWith('image/')) {
        // Handle images: OCR + Translate
        segments = await translateImage(fileUrl, sourceLanguage, targetLanguage, googleApiKey);
      } else if (fileType === 'application/pdf') {
        // Handle PDF: Extract text + Translate
        segments = await translatePDF(fileUrl, sourceLanguage, targetLanguage, googleApiKey);
      } else if (
        fileType.includes('wordprocessingml') ||
        fileType.includes('spreadsheetml')
      ) {
        // Handle DOCX/XLSX: Extract text + Translate
        segments = await translateOfficeDocument(
          fileUrl,
          fileType,
          sourceLanguage,
          targetLanguage,
          googleApiKey
        );
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: ${fileType}` },
          { status: 400 }
        );
      }

      // Update translation with segments
      await convexClient.mutation(api.translations.upsertTranslation, {
        orderId: orderId as any,
        fileName,
        fileIndex,
        segments: segments.map((seg, idx) => ({
          ...seg,
          id: seg.id || `seg-${Date.now()}-${idx}`,
          isEdited: false,
          order: idx,
        })),
        status: 'review',
        progress: 100,
        sourceLanguage,
        targetLanguage,
        clerkId: userId,
      });

      return NextResponse.json({
        success: true,
        segmentsCount: segments.length,
        message: 'Translation completed successfully',
      });
    } catch (error) {
      // Update status to error
      await convexClient.mutation(api.translations.updateTranslationProgress, {
        translationId: translationId as any,
        progress: 0,
        status: 'pending',
        clerkId: userId,
      });

      console.error('Translation error:', error);
      return NextResponse.json(
        {
          error: 'Translation failed',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Translate image using Google Cloud Vision API (OCR) + Translation API
 */
async function translateImage(
  imageUrl: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; order: number }>> {
  // Fetch image
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString('base64');

  // Step 1: OCR using Google Cloud Vision API
  const visionResponse = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }),
    }
  );

  if (!visionResponse.ok) {
    const error = await visionResponse.text();
    throw new Error(`Vision API error: ${error}`);
  }

  const visionData = await visionResponse.json();
  const textAnnotations = visionData.responses[0]?.textAnnotations || [];
  const fullText = textAnnotations[0]?.description || '';

  if (!fullText.trim()) {
    return [];
  }

  // Step 2: Translate using Google Cloud Translation API
  const translatedText = await translateText(fullText, sourceLanguage, targetLanguage, apiKey);

  return [
    {
      id: `img-${Date.now()}`,
      originalText: fullText,
      translatedText,
      isEdited: false,
      order: 0,
    },
  ];
}

async function ocrImageBase64(base64Image: string, apiKey: string): Promise<string> {
  const visionResponse = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }),
    }
  );

  if (!visionResponse.ok) {
    const error = await visionResponse.text();
    throw new Error(`Vision API error: ${error}`);
  }

  const visionData = await visionResponse.json();
  const textAnnotations = visionData.responses?.[0]?.textAnnotations || [];
  const fullText = textAnnotations?.[0]?.description || '';
  return String(fullText || '').trim();
}

/**
 * Translate PDF by extracting text and translating
 */
async function translatePDF(
  pdfUrl: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; pageNumber?: number; order: number }>> {
  // Fetch PDF
  const pdfResponse = await fetch(pdfUrl);
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

  // Extract text from PDF using pdf-parse
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const pdfParseMod: any = await import('pdf-parse');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const PDFParseCtor: any = pdfParseMod?.PDFParse;

  if (typeof PDFParseCtor !== 'function') {
    throw new Error('PDF parsing not available');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const parser: any = new PDFParseCtor({ data: pdfBuffer });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const info: any = await parser.getInfo();
  const totalPages = Number(info?.total) || 1;

  const segments: Array<{
    id: string;
    originalText: string;
    translatedText: string;
    isEdited: boolean;
    pageNumber: number;
    order: number;
  }> = [];

  function stripPdfParsePageSeparators(text: string) {
    // pdf-parse often injects page separators like: "-- 1 of 7 --"
    return text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();
  }

  function chunkTextForTranslate(text: string, maxChunkChars = 4500): string[] {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (normalized.length <= maxChunkChars) return [normalized];

    // Prefer splitting on blank lines/paragraphs, then on single newlines, then hard split.
    const parts = normalized.split(/\n{2,}/g).flatMap((p) => (p.includes("\n") ? p.split("\n") : [p]));
    const chunks: string[] = [];
    let current = "";
    for (const part of parts) {
      const candidate = current ? `${current}\n${part}` : part;
      if (candidate.length <= maxChunkChars) {
        current = candidate;
        continue;
      }
      if (current) chunks.push(current);
      if (part.length <= maxChunkChars) {
        current = part;
      } else {
        // Hard split long parts
        for (let i = 0; i < part.length; i += maxChunkChars) {
          chunks.push(part.slice(i, i + maxChunkChars));
        }
        current = "";
      }
    }
    if (current) chunks.push(current);
    return chunks.filter((c) => c.trim().length > 0);
  }

  // Extract text from each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const textResult: any = await parser.getText({ partial: [pageNum] });
      const pageTextRaw = String(textResult?.text || "").trim();
      const pageText = stripPdfParsePageSeparators(pageTextRaw);

      // Skip pages with no extractable text (common for scanned PDFs).
      if (pageText.length < 5) continue;

      // Translate in chunks to avoid v2 API size limits (~5k chars).
      const chunks = chunkTextForTranslate(pageText);
      const translatedChunks: string[] = [];
      for (const chunk of chunks) {
        // translateText already handles auto-detect source language.
        // eslint-disable-next-line no-await-in-loop
        const translatedChunk = await translateText(chunk, sourceLanguage, targetLanguage, apiKey);
        translatedChunks.push(translatedChunk);
      }
      const translatedText = translatedChunks.join("\n");

        segments.push({
          id: `pdf-page-${pageNum}-${Date.now()}`,
          originalText: pageText,
          translatedText,
          isEdited: false,
          pageNumber: pageNum,
          order: pageNum - 1,
        });
    } catch (err) {
      console.warn(`Failed to extract text from page ${pageNum}:`, err);
    }
  }

  // Cleanup
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await parser.destroy();
  } catch {
    // ignore
  }

  if (segments.length === 0) {
    // Scanned/image-only PDF: render pages -> Vision OCR -> translate
    try {
      const ocrSegments = await translateScannedPdfWithOcr(pdfBuffer, totalPages, sourceLanguage, targetLanguage, apiKey);
      if (ocrSegments.length > 0) return ocrSegments;
    } catch (err) {
      console.warn('[translatePDF] OCR pipeline failed:', err);
      return [
        {
          id: `pdf-ocr-failed-${Date.now()}`,
          originalText:
            "No extractable text was found in this PDF, and OCR failed. This usually means it's a scanned document (image-only PDF).",
          translatedText:
            `OCR/translation failed: ${err instanceof Error ? err.message : String(err)}`,
          isEdited: false,
          pageNumber: 1,
          order: 0,
        },
      ];
    }

    return [
      {
        id: `pdf-ocr-empty-${Date.now()}`,
        originalText:
          "No extractable text was found in this PDF. This usually means it's a scanned document (image-only PDF).",
        translatedText:
          "OCR completed but no text was detected on any page.",
        isEdited: false,
        pageNumber: 1,
        order: 0,
      },
    ];
  }

  return segments;
}

async function translateScannedPdfWithOcr(
  pdfBuffer: Buffer,
  totalPages: number,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; pageNumber?: number; order: number }>> {
  // Render PDF pages to PNG using pdfjs-dist and @napi-rs/canvas
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const canvasMod: any = await import('@napi-rs/canvas');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const createCanvas: any = canvasMod?.createCanvas;

  if (typeof pdfjs?.getDocument !== 'function') {
    throw new Error('pdfjs-dist is not available for OCR rendering');
  }
  if (typeof createCanvas !== 'function') {
    throw new Error('@napi-rs/canvas is not available for OCR rendering');
  }

  // Disable worker in Node environment
  // Convert Buffer to Uint8Array for pdfjs
  const uint8Array = new Uint8Array(pdfBuffer);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const loadingTask: any = pdfjs.getDocument({ data: uint8Array, disableWorker: true });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const pdfDoc: any = await loadingTask.promise;

  const segments: Array<{
    id: string;
    originalText: string;
    translatedText: string;
    isEdited: boolean;
    pageNumber: number;
    order: number;
  }> = [];

  const maxPages = Math.min(totalPages, 50); // safety limit
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const page: any = await pdfDoc.getPage(pageNum);
    // Render at a moderate scale for OCR
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const viewport: any = page.getViewport({ scale: 2 });
    const width = Math.ceil(Number(viewport.width));
    const height = Math.ceil(Number(viewport.height));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const canvas: any = createCanvas(width, height);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const ctx: any = canvas.getContext('2d');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const renderTask: any = page.render({ canvasContext: ctx, viewport });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await renderTask.promise;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const pngBuf: Buffer = canvas.toBuffer('image/png');
    const base64 = pngBuf.toString('base64');

    // OCR text
    // eslint-disable-next-line no-await-in-loop
    const ocrText = await ocrImageBase64(base64, apiKey);
    if (!ocrText || ocrText.length < 5) continue;

    // Translate OCR text (chunk to avoid limits)
    // eslint-disable-next-line no-await-in-loop
    const translatedText = await translateText(ocrText, sourceLanguage, targetLanguage, apiKey);

    segments.push({
      id: `pdf-ocr-page-${pageNum}-${Date.now()}`,
      originalText: ocrText,
      translatedText,
      isEdited: false,
      pageNumber: pageNum,
      order: pageNum - 1,
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await pdfDoc.cleanup();
  } catch {
    // ignore
  }

  return segments;
}

/**
 * Translate Office documents (DOCX/XLSX)
 */
async function translateOfficeDocument(
  fileUrl: string,
  fileType: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; order: number }>> {
  // For now, return a placeholder
  // In production, you'd use libraries like mammoth (DOCX) or exceljs (XLSX)
  // to extract text, then translate
  
  // Fetch file
  const fileResponse = await fetch(fileUrl);
  const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

  // TODO: Implement proper text extraction for DOCX/XLSX
  // For now, return a simple placeholder
  const placeholderText = `[Document content extraction not yet implemented for ${fileType}]`;
  
  const translatedText = await translateText(
    placeholderText,
    sourceLanguage,
    targetLanguage,
    apiKey
  );

  return [
    {
      id: `office-${Date.now()}`,
      originalText: placeholderText,
      translatedText,
      isEdited: false,
      order: 0,
    },
  ];
}

/**
 * Translate text using Google Cloud Translation API
 */
async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string
): Promise<string> {
  // Handle auto-detect
  const sourceLang = sourceLanguage === 'auto' ? '' : sourceLanguage;

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLang || undefined,
        target: targetLanguage,
        format: 'text',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Translation API error: ${error}`);
  }

  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText || text;
}

