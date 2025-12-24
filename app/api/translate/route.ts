import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Buffer } from 'buffer';
import { generateText } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import {
  getDefaultDocumentDomain,
  getDefaultTranslationProvider,
  getDomainSystemPrompt,
  OPENROUTER_DEFAULT_MODEL,
  isDocumentDomain,
  isTranslationProvider,
  type DocumentDomain,
  type TranslationProvider,
} from '@/lib/translation-providers';
import { getLanguageName } from '@/lib/languages';
import { translateTextV3, performOCR } from '@/lib/google-cloud';
import {
  DEFAULT_PREPROCESSING_OPTIONS,
  AGGRESSIVE_PREPROCESSING_OPTIONS,
  LIGHT_PREPROCESSING_OPTIONS,
} from '@/lib/image-preprocessing';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for translation

/**
 * POST /api/translate
 * Translates a file using a selectable provider (Google Translate, OpenAI, Anthropic)
 * 
 * Body: {
 *   orderId: string,
 *   fileName: string,
 *   fileIndex: number,
 *   fileUrl: string,
 *   fileType: string,
 *   sourceLanguage: string,
 *   targetLanguage: string,
 *   translationProvider?: 'google' | 'openai' | 'anthropic',
 *   documentDomain?: 'general' | 'legal' | 'medical' | 'technical'
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
      translationProvider,
      documentDomain,
      openRouterModel,
      ocrQuality,
    } = body;

    if (!orderId || !fileName || !sourceLanguage || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const provider: TranslationProvider = isTranslationProvider(translationProvider)
      ? translationProvider
      : getDefaultTranslationProvider();

    const domain: DocumentDomain = isDocumentDomain(documentDomain)
      ? documentDomain
      : getDefaultDocumentDomain();

    const ocrQualityNormalized: 'low' | 'high' =
      ocrQuality === 'low' || ocrQuality === 'high' ? ocrQuality : 'high';

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

    // Optional: API key allows REST fallback for Google services.
    // If service-account credentials are configured, the SDK will be used and no API key is required.
    const googleApiKey = process.env.GOOGLE_CLOUD_API_KEY;

    // Initialize translation progress
    const translationId = await convexClient.mutation(api.translations.upsertTranslation, {
      orderId: orderId as any,
      fileName,
      fileIndex,
      translationProvider: provider,
      documentDomain: domain,
      openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
      ocrQuality: ocrQualityNormalized,
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
        segments = await translateImage(fileUrl, sourceLanguage, targetLanguage, {
          provider,
          domain,
          googleApiKey,
          openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
          ocrQuality: ocrQualityNormalized,
        });
      } else if (fileType === 'application/pdf') {
        // Handle PDF: Extract text + Translate
        segments = await translatePDF(fileUrl, sourceLanguage, targetLanguage, {
          provider,
          domain,
          googleApiKey,
          openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
          ocrQuality: ocrQualityNormalized,
        });
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
          {
            provider,
            domain,
            googleApiKey,
            openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
            ocrQuality: ocrQualityNormalized,
          }
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
        translationProvider: provider,
        documentDomain: domain,
        openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
        ocrQuality: ocrQualityNormalized,
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
        translationProvider: provider,
        documentDomain: domain,
        openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
        ocrQuality: ocrQualityNormalized,
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

      // Provide clearer error messages for common issues
      let errorMessage = error instanceof Error ? error.message : String(error);
      let userFriendlyError = 'Translation failed';

      if (errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
        userFriendlyError = 'Translation timed out';
        errorMessage = 'The translation request took too long. This can happen with complex images or when OpenRouter is under heavy load. Please try again, or try using Claude Sonnet 4.5 instead of GPT-5.2.';
      } else if (errorMessage.includes('Temporarily unavailable') || errorMessage.includes('503') || errorMessage.includes('502')) {
        userFriendlyError = 'Service temporarily unavailable';
        errorMessage = 'OpenRouter is temporarily unavailable. Please wait a moment and try again.';
      }

      return NextResponse.json(
        {
          error: userFriendlyError,
          details: errorMessage,
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
  options: TranslationOptions
): Promise<Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; order: number }>> {
  // Fetch image
  const imageResponse = await fetch(imageUrl);
  const headerMediaType = imageResponse.headers.get('content-type') || '';
  const imageBuffer = await imageResponse.arrayBuffer();
  const imageBuf = Buffer.from(imageBuffer);

  // Prefer vision-based translation for OpenRouter so the model can see layout directly (like ChatGPT upload).
  if (options.provider === 'openrouter') {
    try {
      const visionPair = await translateImageViaVisionModel({
        image: imageBuf,
        mediaType: headerMediaType.startsWith('image/') ? headerMediaType : 'image/jpeg',
        sourceLanguage,
        targetLanguage,
        domain: options.domain,
        openRouterModel: options.openRouterModel,
        imageDetail: options.ocrQuality === 'low' ? 'low' : 'high',
      });

      if (visionPair.originalText.trim() || visionPair.translatedText.trim()) {
        return [
          {
            id: `img-vision-${Date.now()}`,
            originalText: visionPair.originalText.trim() || '[No text detected]',
            translatedText: visionPair.translatedText.trim() || '',
            isEdited: false,
            order: 0,
          },
        ];
      }
    } catch (err) {
      console.warn('[translateImage] OpenRouter vision translation failed, falling back to OCR:', err);
      // fall through to OCR pipeline below
    }
  }

  // Fallback: OCR with Google Vision + translate extracted text
  // Uses SDK (service account) if available, otherwise REST (API key) via lib/google-cloud.ts.
  const base64Image = imageBuf.toString('base64');
  const ocrFeatureType = options.ocrQuality === 'low' ? 'TEXT_DETECTION' : 'DOCUMENT_TEXT_DETECTION';

  const ocrText = await ocrImageBase64(base64Image, ocrFeatureType, options.ocrQuality);
  if (!ocrText.trim()) return [];

  const translatedText = await translateText(ocrText, sourceLanguage, targetLanguage, options);

  return [
    {
      id: `img-${Date.now()}`,
      originalText: ocrText,
      translatedText,
      isEdited: false,
      order: 0,
    },
  ];
}

interface TranslationOptions {
  provider: TranslationProvider;
  domain: DocumentDomain;
  googleApiKey?: string;
  openRouterModel?: string;
  ocrQuality?: 'low' | 'high';
}

function chunkTextForTranslation(text: string, maxChunkChars = 4000): string[] {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (normalized.length <= maxChunkChars) return [normalized];

  // Prefer splitting on blank lines/paragraphs, then on single newlines, then hard split.
  const parts = normalized
    .split(/\n{2,}/g)
    .flatMap((p) => (p.includes('\n') ? p.split('\n') : [p]))
    .map((p) => p.trimEnd());

  const chunks: string[] = [];
  let current = '';
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
      for (let i = 0; i < part.length; i += maxChunkChars) {
        chunks.push(part.slice(i, i + maxChunkChars));
      }
      current = '';
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * OCR using Google Cloud Vision API (SDK)
 * Uses the official @google-cloud/vision SDK for better accuracy and features
 * Includes image preprocessing to improve OCR accuracy for poor quality images
 */
async function ocrImageBase64(
  base64Image: string,
  featureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION',
  ocrQuality: 'low' | 'high' = 'high'
): Promise<string> {
  try {
    // Select preprocessing options based on quality setting
    // 'high' quality = aggressive preprocessing for better OCR on poor images
    // 'low' quality = light preprocessing for faster processing
    const preprocessingOptions =
      ocrQuality === 'high'
        ? DEFAULT_PREPROCESSING_OPTIONS
        : LIGHT_PREPROCESSING_OPTIONS;

    const result = await performOCR(
      Buffer.from(base64Image, 'base64'),
      featureType,
      preprocessingOptions
    );

    if (result.wasPreprocessed) {
      console.log('[OCR] Image was preprocessed for better accuracy');
    }

    return result.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Vision API error: ${message}`);
  }
}

/**
 * Translate PDF by extracting text and translating
 */
async function translatePDF(
  pdfUrl: string,
  sourceLanguage: string,
  targetLanguage: string,
  options: TranslationOptions
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
      const chunks = chunkTextForTranslation(pageText, 4000);
      const translatedChunks: string[] = [];
      for (const chunk of chunks) {
        // translateText already handles auto-detect source language.
        // eslint-disable-next-line no-await-in-loop
        const translatedChunk = await translateText(chunk, sourceLanguage, targetLanguage, options);
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
      const ocrSegments = await translateScannedPdfWithOcr(
        pdfBuffer,
        totalPages,
        sourceLanguage,
        targetLanguage,
        options
      );
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
  options: TranslationOptions
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

  const scale = options.ocrQuality === 'high' ? 3 : 2;
  const ocrFeatureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION' =
    options.ocrQuality === 'low' ? 'TEXT_DETECTION' : 'DOCUMENT_TEXT_DETECTION';

  const maxPages = Math.min(totalPages, 50); // safety limit
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const page: any = await pdfDoc.getPage(pageNum);
    // Render at a moderate scale for OCR
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const viewport: any = page.getViewport({ scale });
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

    // Prefer vision-based translation for OpenRouter (no OCR dependency, better layout)
    if (options.provider === 'openrouter') {
      try {
        // eslint-disable-next-line no-await-in-loop
        const visionPair = await translateImageViaVisionModel({
          image: pngBuf,
          mediaType: 'image/png',
          sourceLanguage,
          targetLanguage,
          domain: options.domain,
          openRouterModel: options.openRouterModel,
          imageDetail: options.ocrQuality === 'low' ? 'low' : 'high',
        });

        if ((visionPair.originalText || '').trim().length > 0 || (visionPair.translatedText || '').trim().length > 0) {
          segments.push({
            id: `pdf-vision-page-${pageNum}-${Date.now()}`,
            originalText: (visionPair.originalText || '').trim() || '[No text detected]',
            translatedText: (visionPair.translatedText || '').trim(),
            isEdited: false,
            pageNumber: pageNum,
            order: pageNum - 1,
          });
          continue;
        }
      } catch (err) {
        console.warn(`[translateScannedPdfWithOcr] OpenRouter vision failed for page ${pageNum}; falling back to OCR`, err);
      }
    }

    // Fallback: OCR with Google Vision + translate extracted text
    const base64 = pngBuf.toString('base64');
    // eslint-disable-next-line no-await-in-loop
    const ocrText = await ocrImageBase64(base64, ocrFeatureType, options.ocrQuality);
    if (!ocrText || ocrText.length < 5) continue;
    // eslint-disable-next-line no-await-in-loop
    const translatedText = await translateText(ocrText, sourceLanguage, targetLanguage, options);

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

async function translateImageViaVisionModel(args: {
  image: Buffer;
  mediaType: string;
  sourceLanguage: string;
  targetLanguage: string;
  domain: DocumentDomain;
  openRouterModel?: string;
  imageDetail?: 'auto' | 'high' | 'low';
}): Promise<{ originalText: string; translatedText: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter is not configured. Please set OPENROUTER_API_KEY.');
  }

  const system = getDomainSystemPrompt(args.domain);
  const source = getLanguageLabelForPrompt(args.sourceLanguage);
  const target = getLanguageLabelForPrompt(args.targetLanguage);
  const model = args.openRouterModel || process.env.OPENROUTER_TRANSLATION_MODEL || OPENROUTER_DEFAULT_MODEL;

  const openrouter = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Translator-app',
    },
  });

  // Vision models with detailed prompts can take 2-4 minutes; default to 5 min timeout
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 300000);
  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), timeoutMs);

  // Comprehensive prompt for document extraction and translation - handles all document types
  const prompt = [
    `You are translating a document from ${source} to ${target}.`,
    '',
    '## YOUR TASK:',
    '1. Extract ALL text from the image exactly as it appears',
    '2. Translate to the target language with PERFECT formatting',
    '3. Preserve the document\'s natural structure',
    '',
    '## CRITICAL: ADAPT TO DOCUMENT TYPE',
    '',
    '### For FORMS/CERTIFICATES (short-form with labeled fields):',
    '- Each field on its own line: "Label: Value"',
    '- Blank lines between sections',
    '- Example:',
    '  Name: John Smith',
    '  Date of Birth: May 17, 1981',
    '  ',
    '  Issue Date: January 15, 2023',
    '',
    '### For CONTRACTS/LEGAL DOCUMENTS (long-form with clauses):',
    '- Preserve article/section numbering exactly',
    '- Keep paragraph indentation and hierarchy',
    '- Maintain clause structure (1.1, 1.2, etc.)',
    '- Example:',
    '  ARTICLE 1: DEFINITIONS',
    '  ',
    '  1.1 "Agreement" means this contract...',
    '  ',
    '  1.2 "Party" means...',
    '',
    '### For TRANSCRIPTS/TABLES:',
    '- Maintain column alignment',
    '- Keep course names, grades, credits in rows',
    '- Preserve semester/year groupings',
    '',
    '### For LETTERS/NARRATIVE TEXT:',
    '- Preserve paragraph structure',
    '- Keep greeting, body, closing format',
    '- Maintain natural text flow',
    '',
    '## FORMATTING RULES (ALL DOCUMENTS):',
    '',
    '1. STRUCTURE: Mirror the source document\'s layout',
    '2. SPACING: Add blank lines between major sections',
    '3. LINE BREAKS: Preserve line breaks from the original',
    '4. DATES: Format as "Month Day, Year" (May 17, 1981)',
    '5. NUMBERS: Keep reference numbers, IDs exactly as shown',
    '',
    '## DO NOT:',
    '- Combine unrelated information with semicolons (;)',
    '- Merge multiple distinct items into one line',
    '- Remove line breaks that exist in the source',
    '- Add commentary or explanations',
    '',
    '## OUTPUT FORMAT:',
    'Return ONLY a JSON object:',
    '{"originalText": "extracted text preserving structure", "translatedText": "formatted translation"}',
    '',
    'No markdown. No explanations. Just the JSON.',
  ].join('\n');

  const result = await generateText({
    // IMPORTANT: OpenRouter is OpenAI-Chat-Completions compatible, not OpenAI Responses API.
    // The AI SDK default model uses /responses, which OpenRouter rejects.
    model: openrouter.chat(model),
    maxRetries: 0,
    // Some reasoning/vision models ignore temperature; AI SDK will warn but still work.
    temperature: 0,
    system,
    abortSignal: abortController.signal,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'file',
            mediaType: args.mediaType,
            data: args.image,
            providerOptions: {
              openai: {
                imageDetail: args.imageDetail ?? 'high',
              },
            },
          },
        ],
      } as any,
    ],
  });

  clearTimeout(abortTimer);

  const raw = String(result.text || '').trim();
  try {
    const obj = JSON.parse(raw) as { originalText?: string; translatedText?: string };
    const originalText = String(obj.originalText || '');
    const translatedText = String(obj.translatedText || '');

    // Optional refinement pass: improves fidelity/formatting without re-reading the image.
    // This mimics how chat apps often do "draft -> revise" internally.
    if (originalText.trim() && translatedText.trim()) {
      try {
        const refineAbortController = new AbortController();
        const refineAbortTimer = setTimeout(() => refineAbortController.abort(), timeoutMs);

        const refine = await generateText({
          model: openrouter.chat(model),
          maxRetries: 0,
          temperature: 0,
          system,
          abortSignal: refineAbortController.signal,
          prompt: [
            `Improve this ${source} to ${target} document translation. Focus on FORMATTING and STRUCTURE.`,
            '',
            '## YOUR TASK:',
            'Review the draft translation and improve formatting while preserving the document\'s natural structure.',
            '',
            '## RULES BY DOCUMENT TYPE:',
            '',
            '### For FORMS/CERTIFICATES:',
            '- Split combined fields into separate lines',
            '- Use "Label: Value" format',
            '- If you see "X; Y" (different fields), split into:',
            '  X',
            '  Y',
            '',
            '### For CONTRACTS/LEGAL:',
            '- Preserve clause numbering (1.1, 1.2, Article 1, etc.)',
            '- Keep paragraph indentation',
            '- Maintain hierarchical structure',
            '',
            '### For TRANSCRIPTS/LISTS:',
            '- Keep tabular alignment',
            '- Preserve item ordering',
            '- Maintain groupings (by semester, category, etc.)',
            '',
            '### For NARRATIVE TEXT:',
            '- Keep paragraph breaks',
            '- Maintain natural text flow',
            '- Don\'t artificially split sentences',
            '',
            '## GENERAL FORMATTING:',
            '',
            '1. ADD SPACING: Blank lines between major sections',
            '2. DATE FORMAT: "Month Day, Year"',
            '3. PRESERVE: All information from draft - just improve structure',
            '4. DO NOT: Add commentary, combine unrelated items',
            '',
            '## Important:',
            '- Identify the document type from context',
            '- Apply appropriate formatting for that type',
            '- The output should read naturally and professionally',
            '',
            'Output JSON only: {"originalText": "...", "translatedText": "..."}',
            '',
            '--- ORIGINAL TEXT ---',
            originalText,
            '',
            '--- DRAFT TRANSLATION (improve formatting) ---',
            translatedText,
          ].join('\n'),
        });

        clearTimeout(refineAbortTimer);

        const refineRaw = String(refine.text || '').trim();
        const refineObj = JSON.parse(refineRaw) as { originalText?: string; translatedText?: string };
        return {
          originalText: String(refineObj.originalText || originalText),
          translatedText: String(refineObj.translatedText || translatedText),
        };
      } catch {
        // ignore refinement failures; return draft
      }
    }

    return { originalText, translatedText };
  } catch {
    // If the model fails to produce JSON, return raw as translated text for visibility.
    return { originalText: '', translatedText: raw };
  }
}

/**
 * Translate Office documents (DOCX/XLSX)
 */
async function translateOfficeDocument(
  fileUrl: string,
  fileType: string,
  sourceLanguage: string,
  targetLanguage: string,
  options: TranslationOptions
): Promise<Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; order: number }>> {
  // Fetch file
  const fileResponse = await fetch(fileUrl);
  const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

  const isDocx =
    fileType.includes('wordprocessingml') || fileUrl.toLowerCase().endsWith('.docx');
  const isXlsx =
    fileType.includes('spreadsheetml') || fileUrl.toLowerCase().endsWith('.xlsx');

  if (isDocx) {
    const { value } = await mammoth.extractRawText({ buffer: fileBuffer });
    const raw = String(value || '').trim();
    if (!raw) return [];

    // Split into paragraphs (keep line breaks; we'll keep them in bilingual export).
    const paragraphs = raw
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/g)
      .map((p) => p.trim())
      .filter(Boolean);

    const segments: Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; order: number }> =
      [];

    let order = 0;
    for (const p of paragraphs) {
      const chunks = chunkTextForTranslation(p, 3500);
      if (chunks.length === 1) {
        // eslint-disable-next-line no-await-in-loop
        const translated = await translateText(p, sourceLanguage, targetLanguage, options);
        segments.push({
          id: `docx-${Date.now()}-${order}`,
          originalText: p,
          translatedText: translated,
          isEdited: false,
          order,
        });
        order += 1;
        continue;
      }

      const translatedChunks: string[] = [];
      for (const chunk of chunks) {
        // eslint-disable-next-line no-await-in-loop
        translatedChunks.push(await translateText(chunk, sourceLanguage, targetLanguage, options));
      }
      segments.push({
        id: `docx-${Date.now()}-${order}`,
        originalText: p,
        translatedText: translatedChunks.join('\n'),
        isEdited: false,
        order,
      });
      order += 1;
    }

    return segments;
  }

  if (isXlsx) {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS types expect Node Buffer; Next/TS may type Buffer as Buffer<ArrayBuffer>.
    await workbook.xlsx.load(fileBuffer as any);

    const segments: Array<{ id: string; originalText: string; translatedText: string; isEdited: boolean; order: number }> =
      [];
    let order = 0;

    workbook.worksheets.forEach((sheet) => {
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          const cellValue =
            typeof cell.value === 'string'
              ? cell.value
              : typeof cell.text === 'string'
              ? cell.text
              : '';
          const text = String(cellValue || '').trim();
          if (!text) return;

          // Store location for review/export
          const originalText = `${sheet.name}!R${rowNumber}C${colNumber}\n${text}`;
          segments.push({
            id: `xlsx-${Date.now()}-${order}`,
            originalText,
            translatedText: '', // fill later
            isEdited: false,
            order,
          });
          order += 1;
        });
      });
    });

    // Translate sequentially to respect rate limits (can be optimized later with concurrency controls).
    for (const seg of segments) {
      // eslint-disable-next-line no-await-in-loop
      seg.translatedText = await translateText(seg.originalText, sourceLanguage, targetLanguage, options);
    }

    return segments;
  }

  // Fallback: unknown Office type
  const placeholderText = `[Unsupported office type for extraction: ${fileType}]`;
  return [
    {
      id: `office-unsupported-${Date.now()}`,
      originalText: placeholderText,
      translatedText: placeholderText,
      isEdited: false,
      order: 0,
    },
  ];
}

/**
 * Translate text using the selected provider
 */
async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  options: TranslationOptions
): Promise<string> {
  const provider = options.provider;

  if (provider === 'google') {
    // Google translation uses `translateTextV3()` which prefers service-account SDK and falls back to API-key REST.
    return translateTextGoogle(text, sourceLanguage, targetLanguage, options.googleApiKey);
  }

  if (provider === 'openai') {
    return translateTextOpenAI(text, sourceLanguage, targetLanguage, options.domain);
  }

  if (provider === 'anthropic') {
    return translateTextAnthropic(text, sourceLanguage, targetLanguage, options.domain);
  }

  if (provider === 'openrouter') {
    return translateTextOpenRouter(
      text,
      sourceLanguage,
      targetLanguage,
      options.domain,
      options.openRouterModel
    );
  }

  return text;
}

/**
 * Translate text using Google Cloud Translation v3 (SDK)
 * Uses the official @google-cloud/translate SDK for better accuracy and features
 *
 * Translation v3 benefits:
 * - Neural Machine Translation with improved accuracy
 * - Glossary support for consistent terminology
 * - Batch translation for large volumes
 * - Better language detection
 */
async function translateTextGoogle(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  _apiKey: string // Kept for API compatibility, SDK handles auth
): Promise<string> {
  try {
    // Handle auto-detect: pass undefined to let v3 auto-detect
    const sourceLang = sourceLanguage === 'auto' ? undefined : sourceLanguage;

    const [translatedText] = await translateTextV3(
      text,
      targetLanguage,
      sourceLang
    );

    return translatedText || text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Translation API error: ${message}`);
  }
}

function getLanguageLabelForPrompt(code: string): string {
  if (code === 'auto') return 'the source language (detect automatically; if Chinese, identify Simplified vs Traditional)';
  return getLanguageName(code) || code;
}

async function translateTextOpenAI(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  domain: DocumentDomain
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI is not configured. Please set OPENAI_API_KEY.');
  }

  const system = getDomainSystemPrompt(domain);
  const source = getLanguageLabelForPrompt(sourceLanguage);
  const target = getLanguageLabelForPrompt(targetLanguage);
  const model = process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o';

  const result = await generateText({
    model: openai(model),
    // Don't retry on quota/auth errors; fail fast so the UI gets a quick, clear message.
    maxRetries: 0,
    temperature: 0,
    system,
    prompt: [
      `Translate from ${source} to ${target}. Follow ALL rules below.`,
      '',
      '## ABSOLUTE RULES:',
      '1. ONE FIELD PER LINE - never combine different fields.',
      '2. NEVER use semicolons (;) to join different pieces of information.',
      '3. Date of Birth and Enrollment Period are ALWAYS on separate lines.',
      '',
      '## CORRECT:',
      'Date of Birth: May 17, 1981',
      'Studied at this institution from September 1999 to July 2003',
      '',
      '## WRONG (never do this):',
      '"Born May 17, 1981; from September 1999 to July 2003"',
      '',
      '## OTHER RULES:',
      '- Preserve all line breaks from source',
      '- Use formal language for official documents',
      '- Format dates as "Month Day, Year"',
      '',
      'Output ONLY the translation.',
      '',
      'TEXT:',
      text,
    ].join('\n'),
  });

  return result.text || text;
}

async function translateTextAnthropic(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  domain: DocumentDomain
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic is not configured. Please set ANTHROPIC_API_KEY.');
  }

  const system = getDomainSystemPrompt(domain);
  const source = getLanguageLabelForPrompt(sourceLanguage);
  const target = getLanguageLabelForPrompt(targetLanguage);
  // Anthropic model availability depends on your account. We try a small fallback chain when the model isn't found.
  const primaryModel = process.env.ANTHROPIC_TRANSLATION_MODEL || 'claude-3-5-sonnet-20240620';
  const fallbackModels = [
    primaryModel,
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  const prompt = [
    `Translate from ${source} to ${target}. Follow ALL rules below.`,
    '',
    '## ABSOLUTE RULES:',
    '1. ONE FIELD PER LINE - never combine different fields.',
    '2. NEVER use semicolons (;) to join different pieces of information.',
    '3. Date of Birth and Enrollment Period are ALWAYS on separate lines.',
    '',
    '## CORRECT:',
    'Date of Birth: May 17, 1981',
    'Studied at this institution from September 1999 to July 2003',
    '',
    '## WRONG (never do this):',
    '"Born May 17, 1981; from September 1999 to July 2003"',
    '',
    '## OTHER RULES:',
    '- Preserve all line breaks from source',
    '- Use formal language for official documents',
    '- Format dates as "Month Day, Year"',
    '',
    'Output ONLY the translation.',
    '',
    'TEXT:',
    text,
  ].join('\n');

  const isModelNotFound = (err: unknown) => {
    if (!err || typeof err !== 'object') return false;
    const anyErr = err as any;
    const statusCode = typeof anyErr.statusCode === 'number' ? anyErr.statusCode : undefined;
    const responseBody = typeof anyErr.responseBody === 'string' ? anyErr.responseBody : '';
    const message = typeof anyErr.message === 'string' ? anyErr.message : '';
    if (statusCode !== 404) return false;
    return responseBody.includes('not_found_error') && (responseBody.includes('"model:') || message.includes('model:'));
  };

  let lastErr: unknown;
  for (const model of fallbackModels) {
    try {
      const result = await generateText({
        model: anthropic(model),
        maxRetries: 0,
        temperature: 0,
        system,
        prompt,
      });
      return result.text || text;
    } catch (err) {
      lastErr = err;
      if (isModelNotFound(err)) continue;
      throw err;
    }
  }

  throw new Error(
    [
      'Anthropic translation failed because the selected model is not available for your API key.',
      `Tried models: ${fallbackModels.join(', ')}`,
      'Fix: set ANTHROPIC_TRANSLATION_MODEL in .env.local to a model your account has access to.',
      `Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    ].join('\n')
  );
}

async function translateTextOpenRouter(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  domain: DocumentDomain,
  openRouterModel?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter is not configured. Please set OPENROUTER_API_KEY.');
  }

  const system = getDomainSystemPrompt(domain);
  const source = getLanguageLabelForPrompt(sourceLanguage);
  const target = getLanguageLabelForPrompt(targetLanguage);

  const model =
    openRouterModel ||
    process.env.OPENROUTER_TRANSLATION_MODEL ||
    OPENROUTER_DEFAULT_MODEL;

  const openrouter = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      // Optional but recommended by OpenRouter
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Translator-app',
    },
  });

  // Vision models with detailed prompts can take 2-4 minutes; default to 5 min timeout
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 300000);
  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), timeoutMs);

  const result = await generateText({
    // IMPORTANT: OpenRouter is OpenAI-Chat-Completions compatible, not OpenAI Responses API.
    model: openrouter.chat(model),
    maxRetries: 0,
    temperature: 0,
    system,
    abortSignal: abortController.signal,
    prompt: [
      `Translate from ${source} to ${target}. Professional document translation.`,
      '',
      '## CRITICAL: PRESERVE DOCUMENT STRUCTURE',
      '',
      'Identify the document type and apply appropriate formatting:',
      '',
      '### FORMS/CERTIFICATES (labeled fields):',
      '- Each field on its own line: "Label: Value"',
      '- Blank lines between sections',
      '- Never combine different fields',
      '',
      '### CONTRACTS/LEGAL (structured clauses):',
      '- Preserve all numbering (Article 1, 1.1, (a), etc.)',
      '- Keep paragraph hierarchy and indentation',
      '- Maintain section breaks',
      '',
      '### TRANSCRIPTS/TABLES (columnar data):',
      '- Keep items aligned and separated',
      '- Preserve row/column structure',
      '- Maintain groupings',
      '',
      '### LETTERS/NARRATIVE (flowing text):',
      '- Keep paragraph breaks intact',
      '- Preserve greeting/body/closing structure',
      '- Maintain natural flow',
      '',
      '## FORMATTING RULES (ALL DOCUMENTS):',
      '',
      '1. SPACING: Add blank lines between major sections',
      '2. DATES: Use "Month Day, Year" format',
      '3. NAMES: Use standard romanization',
      '4. NUMBERS: Preserve reference numbers, IDs exactly',
      '',
      '## DO NOT:',
      '- Combine unrelated information with semicolons (;)',
      '- Merge distinct fields into one line',
      '- Remove existing line breaks',
      '- Add explanations or notes',
      '',
      '---',
      'Output ONLY the translation.',
      '',
      'TEXT TO TRANSLATE:',
      '',
      text,
    ].join('\n'),
  });

  clearTimeout(abortTimer);

  return result.text || text;
}

