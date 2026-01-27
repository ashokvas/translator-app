import { auth } from '@clerk/nextjs/server';
import { verifyToken } from '@clerk/backend';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Buffer } from 'buffer';
import { generateText } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import {
  getDefaultDocumentDomain,
  getDefaultTranslationProvider,
  getDomainSystemPrompt,
  getDomainTerminologyGuidance,
  OPENROUTER_DEFAULT_MODEL,
  isDocumentDomain,
  isTranslationProvider,
  type DocumentDomain,
  type TranslationProvider,
} from '@/lib/translation-providers';
import { getLanguageName } from '@/lib/languages';
import { translateTextV3, performOCR, getGlossaryNameForDomain, detectLanguageV3, type GlossaryConfig } from '@/lib/google-cloud';
import { performDocumentAiOcr } from '@/lib/document-ai';
import {
  DEFAULT_PREPROCESSING_OPTIONS,
  AGGRESSIVE_PREPROCESSING_OPTIONS,
  LIGHT_PREPROCESSING_OPTIONS,
  preprocessImageForOCR,
} from '@/lib/image-preprocessing';

export const runtime = 'nodejs';
// Next.js/Vercel function timeout - set to 5 minutes for complex translations
// IMPORTANT: If behind Cloudflare proxy (free/pro), CF has a 100-second timeout.
// Options to handle this:
// 1. Set SKIP_REFINEMENT_PASS=true to reduce translation time
// 2. Use OPENROUTER_TIMEOUT_MS=90000 to fail before CF timeout
// 3. Create an API subdomain with DNS-only (gray cloud) to bypass CF proxy
// See FIX_524_TIMEOUT.md for detailed instructions.
export const maxDuration = 300; // 5 minutes for translation

// CORS headers for API subdomain
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || 'https://translatoraxis.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Helper to create JSON response with CORS headers
 */
function jsonWithCors(data: any, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init?.headers || {}),
    },
  });
}

/**
 * Handle OPTIONS preflight request for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

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
  const startedAt = Date.now();
  const usageEvents: TranslationUsageEvent[] = [];
  // Track usage events without affecting translation behavior.
  const trackUsage = (event: TranslationUsageEvent) => {
    usageEvents.push(event);
  };

  try {
    // Authenticate admin - supports both cookie-based auth (same domain)
    // and Bearer token auth (cross-subdomain API calls)
    let userId: string | null = null;
    
    // First, check for Bearer token in Authorization header (cross-subdomain)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const verifiedToken = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
          authorizedParties: [
            'https://translatoraxis.com',
            'https://www.translatoraxis.com',
            process.env.NEXT_PUBLIC_SITE_URL || '',
          ].filter(Boolean),
        });
        userId = verifiedToken.sub;
      } catch (tokenError) {
        console.error('Bearer token verification failed:', tokenError);
        // Fall through to try cookie-based auth
      }
    }
    
    // If no Bearer token or verification failed, try cookie-based auth
    if (!userId) {
      const authResult = await auth();
      userId = authResult?.userId ?? null;
    }

    if (!userId) {
      return jsonWithCors({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role via Convex
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return jsonWithCors({ error: 'Convex not configured' }, { status: 500 });
    }

    const convexClient = new ConvexHttpClient(convexUrl);
    const userRole = await convexClient.query(api.users.getCurrentUserRole, {
      clerkId: userId,
    });

    if (userRole?.role !== 'admin') {
      return jsonWithCors({ error: 'Admin access required' }, { status: 403 });
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
      ocrProvider,
      ocrMultiPass,
    } = body;

    if (!orderId || !fileName || !sourceLanguage || !targetLanguage) {
      return jsonWithCors(
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

    const ocrQualityNormalized: 'low' | 'high' | 'enhanced' =
      ocrQuality === 'low' || ocrQuality === 'high' || ocrQuality === 'enhanced'
        ? ocrQuality
        : 'high';
    const ocrProviderNormalized: 'vision' | 'document_ai' =
      ocrProvider === 'document_ai' ? 'document_ai' : 'vision';
    const ocrMultiPassEnabled = Boolean(ocrMultiPass);

    // If fileUrl or fileType not provided, fetch from Convex
    if (!fileUrl || !fileType) {
      const order = await convexClient.query(api.orders.getOrderWithFiles, {
        orderId: orderId as any,
        clerkId: userId,
      });

      if (!order || !order.files || !order.files[fileIndex]) {
        return jsonWithCors(
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
          ocrProvider: ocrProviderNormalized,
          ocrMultiPass: ocrMultiPassEnabled,
          trackUsage,
        });
      } else if (fileType === 'application/pdf') {
        // Handle PDF: Extract text + Translate
        segments = await translatePDF(fileUrl, sourceLanguage, targetLanguage, {
          provider,
          domain,
          googleApiKey,
          openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
          ocrQuality: ocrQualityNormalized,
          ocrProvider: ocrProviderNormalized,
          ocrMultiPass: ocrMultiPassEnabled,
          trackUsage,
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
            ocrProvider: ocrProviderNormalized,
            ocrMultiPass: ocrMultiPassEnabled,
            trackUsage,
          }
        );
      } else {
        return jsonWithCors(
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

      // If source language was 'auto', detect the actual language and update the order
      let detectedLanguage: string | undefined;
      if (sourceLanguage === 'auto' && segments.length > 0) {
        try {
          // Get a sample of original text for language detection
          const sampleText = segments
            .slice(0, 3)
            .map((s) => s.originalText)
            .join('\n')
            .slice(0, 1000); // Limit to 1000 chars for detection

          if (sampleText.trim()) {
            const detection = await detectLanguageV3(sampleText);
            if (detection.languageCode && detection.languageCode !== 'und' && detection.confidence > 0.5) {
              detectedLanguage = detection.languageCode;
              // Update the order with the detected source language
              await convexClient.mutation(api.orders.updateDetectedSourceLanguage, {
                orderId: orderId as any,
                detectedSourceLanguage: detection.languageCode,
                clerkId: userId,
              });
            }
          }
        } catch (detectError) {
          console.warn('Language detection failed:', detectError);
          // Continue without detected language - not critical
        }
      }

      if (usageEvents.length > 0) {
        try {
          await convexClient.mutation(api.usage.recordUsageEvents, {
            orderId: orderId as any,
            fileName,
            clerkId: userId,
            events: usageEvents,
          });
        } catch (usageError) {
          console.warn('Failed to persist translation usage:', usageError);
        }
      }

      console.info(
        '[translation-usage]',
        JSON.stringify({
          orderId,
          fileName,
          fileType,
          provider,
          domain,
          model:
            provider === 'openrouter'
              ? (openRouterModel || process.env.OPENROUTER_TRANSLATION_MODEL || OPENROUTER_DEFAULT_MODEL)
              : provider === 'openai'
              ? (process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o')
              : provider === 'anthropic'
              ? (process.env.ANTHROPIC_TRANSLATION_MODEL || 'claude-3-5-sonnet-20240620')
              : undefined,
          durationMs: Date.now() - startedAt,
          events: usageEvents,
        })
      );

      return jsonWithCors({
        success: true,
        segmentsCount: segments.length,
        message: 'Translation completed successfully',
        translationProvider: provider,
        documentDomain: domain,
        openRouterModel: typeof openRouterModel === 'string' ? openRouterModel : undefined,
        ocrQuality: ocrQualityNormalized,
        detectedSourceLanguage: detectedLanguage,
      });
    } catch (error) {
      // Update status to error
      await convexClient.mutation(api.translations.updateTranslationProgress, {
        translationId: translationId as any,
        progress: 0,
        status: 'pending',
        clerkId: userId,
      });

      if (usageEvents.length > 0) {
        try {
          await convexClient.mutation(api.usage.recordUsageEvents, {
            orderId: orderId as any,
            fileName,
            clerkId: userId,
            events: usageEvents,
          });
        } catch (usageError) {
          console.warn('Failed to persist translation usage:', usageError);
        }
      }

      console.warn(
        '[translation-usage]',
        JSON.stringify({
          orderId,
          fileName,
          fileType,
          provider,
          domain,
          durationMs: Date.now() - startedAt,
          events: usageEvents,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      console.error('Translation error:', error);

      // Provide clearer error messages for common issues
      let errorMessage = error instanceof Error ? error.message : String(error);
      let userFriendlyError = 'Translation failed';

      if (errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
        userFriendlyError = 'Translation timed out';
        errorMessage = 'The translation request took too long. This can happen with complex images or when OpenRouter is under heavy load. Try: (1) Use a faster model like GPT-4o or Claude Sonnet 4, (2) Set SKIP_REFINEMENT_PASS=true in environment, (3) Use an API subdomain that bypasses Cloudflare proxy. See FIX_524_TIMEOUT.md for details.';
      } else if (errorMessage.includes('524') || errorMessage.includes('timeout occurred')) {
        userFriendlyError = 'Cloudflare timeout';
        errorMessage = 'Cloudflare terminated the connection (524 error). Translation took longer than 100 seconds. Solutions: (1) Use a faster model, (2) Set SKIP_REFINEMENT_PASS=true, (3) Create an API subdomain with DNS-only to bypass CF proxy. See FIX_524_TIMEOUT.md.';
      } else if (errorMessage.includes('Temporarily unavailable') || errorMessage.includes('503') || errorMessage.includes('502')) {
        userFriendlyError = 'Service temporarily unavailable';
        errorMessage = 'OpenRouter is temporarily unavailable. Please wait a moment and try again.';
      }

      return jsonWithCors(
        {
          error: userFriendlyError,
          details: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Translation API error:', error);
    console.warn(
      '[translation-usage]',
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        events: usageEvents,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return jsonWithCors(
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

  // If Document AI OCR is selected, skip OpenRouter vision and use Document AI text extraction.
  if (options.ocrProvider === 'document_ai') {
    const mimeType = headerMediaType.startsWith('image/') ? headerMediaType : 'image/jpeg';
    const processedBuffer =
      options.ocrQuality === 'enhanced'
        ? await preprocessImageForOCR(imageBuf, AGGRESSIVE_PREPROCESSING_OPTIONS)
        : imageBuf;

    const docAiResult = await performDocumentAiOcr(processedBuffer, mimeType);
    if (!docAiResult.text.trim()) return [];

    options.trackUsage?.({
      provider: 'google-document-ai',
      kind: 'ocr',
      requests: docAiResult.pageCount,
    });

    const translatedText = await translateText(docAiResult.text, sourceLanguage, targetLanguage, options);
    return [
      {
        id: `img-docai-${Date.now()}`,
        originalText: docAiResult.text,
        translatedText,
        isEdited: false,
        order: 0,
      },
    ];
  }

  // Prefer vision-based translation for OpenRouter so the model can see layout directly (like ChatGPT upload).
  if (options.provider === 'openrouter') {
    try {
      const sliceCount = options.ocrMultiPass ? 5 : 3;
      const visionPair = await translateImageViaVisionModelMultiPass({
        image: imageBuf,
        mediaType: headerMediaType.startsWith('image/') ? headerMediaType : 'image/jpeg',
        sourceLanguage,
        targetLanguage,
        domain: options.domain,
        openRouterModel: options.openRouterModel,
        imageDetail: options.ocrQuality === 'low' ? 'low' : 'high',
        sliceCount,
        trackUsage: options.trackUsage,
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

  options.trackUsage?.({
    provider: 'google-vision',
    kind: 'ocr',
    requests: options.ocrMultiPass ? 2 : 1,
  });
  const ocrText = await ocrImageBase64(
    base64Image,
    ocrFeatureType,
    options.ocrQuality,
    options.ocrMultiPass
  );
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
  ocrQuality?: 'low' | 'high' | 'enhanced';
  ocrProvider?: 'vision' | 'document_ai';
  ocrMultiPass?: boolean;
  trackUsage?: (event: TranslationUsageEvent) => void;
}

interface TranslationUsageEvent {
  provider: string;
  kind: 'text' | 'vision' | 'ocr';
  model?: string;
  inputChars?: number;
  outputChars?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requests?: number;
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

function mergeOcrText(primary: string, secondary: string): string {
  const primaryLines = primary.split('\n').map((line) => line.trim()).filter(Boolean);
  const secondaryLines = secondary.split('\n').map((line) => line.trim()).filter(Boolean);
  const seen = new Set(primaryLines.map((line) => line.toLowerCase()));
  const merged = [...primaryLines];

  for (const line of secondaryLines) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      merged.push(line);
      seen.add(key);
    }
  }

  return merged.join('\n');
}

/**
 * OCR using Google Cloud Vision API (SDK)
 * Uses the official @google-cloud/vision SDK for better accuracy and features
 * Includes image preprocessing to improve OCR accuracy for poor quality images
 */
async function ocrImageBase64(
  base64Image: string,
  featureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION',
  ocrQuality: 'low' | 'high' | 'enhanced' = 'high',
  ocrMultiPass = false
): Promise<string> {
  try {
    // Select preprocessing options based on quality setting
    // 'high' quality = aggressive preprocessing for better OCR on poor images
    // 'low' quality = light preprocessing for faster processing
    const preprocessingOptions =
      ocrQuality === 'enhanced'
        ? AGGRESSIVE_PREPROCESSING_OPTIONS
        : ocrQuality === 'high'
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

    if (!ocrMultiPass) {
      return result.text;
    }

    // Second pass with aggressive preprocessing to catch missed text.
    const secondPass = await performOCR(
      Buffer.from(base64Image, 'base64'),
      featureType,
      AGGRESSIVE_PREPROCESSING_OPTIONS
    );

    const merged = mergeOcrText(result.text, secondPass.text);
    return merged;
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

  // Extract text from PDF using pdf-parse v1.x
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
  const pdfParse: any = require('pdf-parse');
  
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const pdfData: any = await pdfParse(pdfBuffer);
  const totalPages = Number(pdfData?.numpages) || 1;
  const fullText = String(pdfData?.text || "").trim();

  const segments: Array<{
    id: string;
    originalText: string;
    translatedText: string;
    isEdited: boolean;
    pageNumber: number;
    order: number;
  }> = [];

  // pdf-parse v1.x extracts all text at once, split by form feeds or estimate pages
  // Split by form feed character (page break) if present
  let pageTexts = fullText.split(/\f/).filter(t => t.trim().length > 5);
  
  // If no form feeds, treat as single document
  if (pageTexts.length === 0 && fullText.length > 5) {
    pageTexts = [fullText];
  }

  // Translate each page/section
  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i].trim();
    const pageNum = i + 1;

    // Skip pages with no extractable text
    if (pageText.length < 5) continue;

    // Translate in chunks to avoid API size limits (~5k chars).
    const chunks = chunkTextForTranslation(pageText, 4000);
    const translatedChunks: string[] = [];
    for (const chunk of chunks) {
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
  }

  if (segments.length === 0) {
    if (options.ocrProvider === 'document_ai') {
      try {
        const docAiResult = await performDocumentAiOcr(pdfBuffer, 'application/pdf');
        if (docAiResult.text.trim()) {
          options.trackUsage?.({
            provider: 'google-document-ai',
            kind: 'ocr',
            requests: docAiResult.pageCount,
          });

          const translatedText = await translateText(
            docAiResult.text,
            sourceLanguage,
            targetLanguage,
            options
          );

          return [
            {
              id: `pdf-docai-${Date.now()}`,
              originalText: docAiResult.text,
              translatedText,
              isEdited: false,
              pageNumber: 1,
              order: 0,
            },
          ];
        }
      } catch (err) {
        console.warn('[translatePDF] Document AI OCR failed:', err);
      }
    }

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
  // Render PDF pages to PNG using pdfjs-dist (v3.x) and @napi-rs/canvas
  // We use the legacy CommonJS build which works in Node.js without workers
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
  const pdfjs: any = require('pdfjs-dist/legacy/build/pdf.js');
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
  const loadingTask: any = pdfjs.getDocument({ data: uint8Array, isEvalSupported: false, disableFontFace: true });
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
        const visionPair = await translateImageViaVisionModelMultiPass({
          image: pngBuf,
          mediaType: 'image/png',
          sourceLanguage,
          targetLanguage,
          domain: options.domain,
          openRouterModel: options.openRouterModel,
          imageDetail: options.ocrQuality === 'low' ? 'low' : 'high',
          sliceCount: 3,
          trackUsage: options.trackUsage,
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
    options.trackUsage?.({
      provider: 'google-vision',
      kind: 'ocr',
      requests: options.ocrMultiPass ? 2 : 1,
    });
    const ocrText = await ocrImageBase64(
      base64,
      ocrFeatureType,
      options.ocrQuality,
      options.ocrMultiPass
    );
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
  visionFocus?: 'full' | 'slice';
  sliceIndex?: number; // 0-based
  sliceCount?: number;
  trackUsage?: (event: TranslationUsageEvent) => void;
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
  const focusNote =
    args.visionFocus === 'slice'
      ? [
          `## CROPPED INPUT (VERTICAL SLICE ${Number(args.sliceIndex ?? 0) + 1} of ${Number(args.sliceCount ?? 1)})`,
          '- You are ONLY seeing this vertical slice of the page.',
          '- Extract ALL text visible in this crop.',
          '- If a cell/row is unreadable, write "[UNREADABLE]" rather than skipping it.',
          '- Do NOT invent content from other parts of the page that are not visible in this crop.',
        ].join('\n')
      : '';

  const prompt = [
    `You are translating a document from ${source} to ${target}.`,
    '',
    '## YOUR TASK:',
    '1. CAREFULLY examine the image layout and structure',
    '2. Extract ALL text from the image exactly as it appears',
    '3. Translate with formatting that MIRRORS the original EXACTLY',
    '',
    '## CRITICAL: ORIGINAL VS TRANSLATION',
    '',
    '- `originalText` MUST be a VERBATIM EXTRACTION of the source document text.',
    '- DO NOT TRANSLATE in `originalText`.',
    `- Preserve the original script for ${source} (e.g. keep Chinese characters).`,
    '- Keep punctuation, numbers, names, and layout markers as-is in `originalText`.',
    '- `translatedText` MUST be the translation to the target language.',
    ...(focusNote ? ['', focusNote] : []),
    '',
    '## CRITICAL: PRODUCE PROPERLY ALIGNED TABLES',
    '',
    '### TABLE REQUIREMENTS:',
    '',
    '1. **EXACT MATCH**: Same columns, same rows as original',
    '',
    '2. **ALIGNED COLUMNS**: Each column must have FIXED WIDTH',
    '   - Pad cells with spaces so columns align vertically',
    '   - Vertical lines must be continuous from top to bottom',
    '',
    '3. **PROPER TABLE FORMAT**:',
    '',
    '```',
    '| Course Name          | Credits | Grade | Type     | Date       |',
    '|----------------------|---------|-------|----------|------------|',
    '| English              | 4       | 72    | Required | 2000-01-13 |',
    '| Advanced Mathematics | 5       | 67    | Required | 2000-01-13 |',
    '| Physical Education   | 1       | 74    | Required | 2000-01-13 |',
    '```',
    '',
    '   Notice: All | characters LINE UP vertically!',
    '',
    '4. **COLUMN WIDTH RULES**:',
    '   - Find the LONGEST value in each column',
    '   - Pad ALL cells in that column to match that width',
    '   - Use spaces to pad: "English" becomes "English              " if column is 20 chars wide',
    '',
    '5. **ROW COUNT**: MUST match original exactly',
    '   - Count rows in original document',
    '   - Output SAME number of rows',
    '',
    '6. **FOR SIDE-BY-SIDE TABLES**:',
    '   If original shows LEFT and RIGHT course columns:',
    '```',
    '| Course Name (Left)   | Cr | Grade | Type | Date       | Course Name (Right)  | Cr | Grade | Type | Date       |',
    '|----------------------|----|-------|------|------------|----------------------|----|-------|------|------------|',
    '| English              | 4  | 72    | Req  | 2000-01-13 | Physics              | 4  | 68    | Req  | 2000-07-06 |',
    '```',
    '',
    '### HEADER INFO (before tables):',
    'Student ID: XXXXX',
    'Name: XXXXX',
    '',
    '### FOOTER (after tables):',
    'Total Credits: XXX',
    '',
    '## OUTPUT FORMAT:',
    'Return ONLY a JSON object:',
    '{"originalText": "extracted text", "translatedText": "translation with ALIGNED tables"}',
    '',
    'CRITICAL: Columns must align vertically - all | characters in a column must be directly above/below each other!',
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

  const usage = (result as any)?.usage;
  args.trackUsage?.({
    provider: 'openrouter',
    kind: 'vision',
    model,
    outputChars: (result.text || '').length,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    totalTokens: usage?.totalTokens,
  });

  const raw = String(result.text || '').trim();
  
  // Helper to extract JSON from markdown code blocks
  function extractJSON(text: string): string {
    // Remove markdown code blocks if present: ```json ... ``` or ``` ... ```
    let cleaned = text.trim();
    // Match ```json or ``` at the start
    const startMatch = cleaned.match(/^```(?:json)?\s*\n?/i);
    if (startMatch) {
      cleaned = cleaned.slice(startMatch[0].length);
    }
    // Match ``` at the end
    const endMatch = cleaned.match(/\n?```\s*$/);
    if (endMatch) {
      cleaned = cleaned.slice(0, -endMatch[0].length);
    }
    return cleaned.trim();
  }
  
  try {
    const jsonStr = extractJSON(raw);
    const obj = JSON.parse(jsonStr) as { originalText?: string; translatedText?: string };
    const originalText = String(obj.originalText || '');
    const translatedText = String(obj.translatedText || '');

    // Optional refinement pass: improves fidelity/formatting without re-reading the image.
    // This mimics how chat apps often do "draft -> revise" internally.
    // 
    // IMPORTANT: If behind Cloudflare proxy (free/pro), the total request time must be < 100 seconds.
    // The refinement pass adds ~1-2 minutes. Set SKIP_REFINEMENT_PASS=true to skip it.
    // Alternatively, use an API subdomain with DNS-only (gray cloud) to bypass CF proxy timeout.
    const skipRefinement = process.env.SKIP_REFINEMENT_PASS === 'true';
    
    if (!skipRefinement && originalText.trim() && translatedText.trim()) {
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
            `Fix the table formatting in this translation. Make columns ALIGN PROPERLY.`,
            '',
            '## YOUR TASK:',
            'Reformat the table so all columns align vertically.',
            '',
            '## DO NOT CHANGE originalText',
            '- You must keep the provided `originalText` EXACTLY as-is.',
            '- Only adjust `translatedText` formatting/alignment.',
            '',
            '## CRITICAL: ALIGNED COLUMNS',
            '',
            'All | characters in a column MUST line up vertically!',
            '',
            '### CORRECT FORMAT (columns align):',
            '```',
            '| Course Name          | Credits | Grade | Type     | Date       |',
            '|----------------------|---------|-------|----------|------------|',
            '| English              | 4       | 72    | Required | 2000-01-13 |',
            '| Advanced Mathematics | 5       | 67    | Required | 2000-01-13 |',
            '| Physical Education   | 1       | 74    | Required | 2000-01-13 |',
            '```',
            '',
            '### HOW TO ALIGN:',
            '1. Find the LONGEST text in each column',
            '2. Pad ALL cells in that column to match that width',
            '3. Use spaces for padding',
            '',
            '### WRONG (misaligned - DO NOT DO THIS):',
            '| Course Name | Credits | Grade |',
            '|---|---|---|',
            '| English | 4 | 72 |',
            '| Advanced Mathematics | 5 | 67 |',
            '',
            '### RULES:',
            '- Same number of columns in every row',
            '- Same number of rows as original',
            '- Separator dashes must match column width: |----------------------|',
            '- All | must align vertically through entire table',
            '',
            '## Output JSON only:',
            '{"originalText": "...", "translatedText": "table with ALIGNED columns"}',
            '',
            '--- ORIGINAL (DO NOT MODIFY) ---',
            originalText,
            '',
            '--- TRANSLATION DRAFT TO FIX ---',
            translatedText,
          ].join('\n'),
        });

        clearTimeout(refineAbortTimer);

        const refineRaw = String(refine.text || '').trim();
        const refineJsonStr = extractJSON(refineRaw);
        const refineObj = JSON.parse(refineJsonStr) as { originalText?: string; translatedText?: string };
        return {
          originalText: String(refineObj.originalText || originalText),
          translatedText: String(refineObj.translatedText || translatedText),
        };
      } catch {
        // ignore refinement failures; return draft
      }
    }

    return { originalText, translatedText };
  } catch (parseError) {
    // If the model fails to produce valid JSON, try to extract content manually
    console.warn('[translateImageViaVisionModel] JSON parse failed, attempting manual extraction:', parseError);
    
    // Try to find originalText and translatedText patterns in the raw text
    const originalMatch = raw.match(/"originalText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const translatedMatch = raw.match(/"translatedText"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    
    if (originalMatch || translatedMatch) {
      return {
        originalText: originalMatch ? originalMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
        translatedText: translatedMatch ? translatedMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : raw,
      };
    }
    
    // Last resort: return raw as translated text for visibility
    return { originalText: '', translatedText: raw };
  }
}

async function cropVerticalSliceToPng(input: Buffer, sliceIndex: number, sliceCount: number): Promise<Buffer> {
  const img = sharp(input);
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error('Unable to determine image dimensions for cropping');

  const safeCount = Math.max(1, Math.floor(sliceCount));
  const safeIndex = Math.min(Math.max(0, Math.floor(sliceIndex)), safeCount - 1);

  const baseSliceWidth = Math.floor(width / safeCount);
  const left = safeIndex * baseSliceWidth;
  const cropWidth = safeIndex === safeCount - 1 ? Math.max(1, width - left) : Math.max(1, baseSliceWidth);

  return await img
    .extract({ left, top: 0, width: cropWidth, height })
    .png()
    .toBuffer();
}

function mergeVisionPairs(full: { originalText: string; translatedText: string }, right: { originalText: string; translatedText: string }) {
  const fullOriginal = String(full.originalText || '').trim();
  const fullTranslated = String(full.translatedText || '').trim();
  const rightOriginal = String(right.originalText || '').trim();
  const rightTranslated = String(right.translatedText || '').trim();

  // If the slice output looks identical, don't duplicate it.
  const rightSeemsDuplicate =
    !!rightOriginal &&
    (fullOriginal.includes(rightOriginal.slice(0, Math.min(200, rightOriginal.length))) ||
      fullTranslated.includes(rightTranslated.slice(0, Math.min(200, rightTranslated.length))));

  if (!rightOriginal || rightSeemsDuplicate) {
    return { originalText: fullOriginal, translatedText: fullTranslated };
  }

  // Keep output simple: append right-side content as an additional block/table.
  return {
    originalText: [fullOriginal, rightOriginal].filter(Boolean).join('\n\n'),
    translatedText: [fullTranslated, rightTranslated].filter(Boolean).join('\n\n'),
  };
}

async function translateImageViaVisionModelMultiPass(args: {
  image: Buffer;
  mediaType: string;
  sourceLanguage: string;
  targetLanguage: string;
  domain: DocumentDomain;
  openRouterModel?: string;
  imageDetail?: 'auto' | 'high' | 'low';
  sliceCount: number;
  trackUsage?: (event: TranslationUsageEvent) => void;
}): Promise<{ originalText: string; translatedText: string }> {
  const full = await translateImageViaVisionModel({ ...args, visionFocus: 'full' });

  // Dense certificates often have 2-4 columns; a single full-page read can miss columns.
  // Run additional passes over vertical slices (e.g. thirds) and merge results.
  const slices = Math.max(1, Math.floor(args.sliceCount));
  let merged = full;

  for (let i = 0; i < slices; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const slicePng = await cropVerticalSliceToPng(args.image, i, slices);
      // eslint-disable-next-line no-await-in-loop
      const slice = await translateImageViaVisionModel({
        ...args,
        image: slicePng,
        mediaType: 'image/png',
        visionFocus: 'slice',
        sliceIndex: i,
        sliceCount: slices,
      });
      merged = mergeVisionPairs(merged, slice);
    } catch (err) {
      console.warn(`[translateImageViaVisionModelMultiPass] slice ${i + 1}/${slices} failed:`, err);
    }
  }

  return merged;
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
    // With v3 SDK, we can use glossaries for domain-specific terminology.
    return translateTextGoogle(text, sourceLanguage, targetLanguage, options.domain, options.trackUsage);
  }

  if (provider === 'openai') {
    return translateTextOpenAI(text, sourceLanguage, targetLanguage, options.domain, options.trackUsage);
  }

  if (provider === 'anthropic') {
    return translateTextAnthropic(text, sourceLanguage, targetLanguage, options.domain, options.trackUsage);
  }

  if (provider === 'openrouter') {
    return translateTextOpenRouter(
      text,
      sourceLanguage,
      targetLanguage,
      options.domain,
      options.openRouterModel,
      options.trackUsage
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
 * - Glossary support for consistent terminology (when configured)
 * - Batch translation for large volumes
 * - Better language detection
 *
 * Glossary Setup (for domain-specific terms):
 * 1. Create CSV glossary files with term pairs for each domain
 * 2. Upload to Google Cloud Storage
 * 3. Create glossary resources using the createGlossary() function
 * 4. Glossary names: certificate-official-terms, legal-terms, medical-terms, technical-terms
 */
/**
 * Post-process Google Translation output to restore formatting and structure
 */
function postProcessGoogleTranslation(originalText: string, translatedText: string): string {
  const originalLines = originalText.split('\n');
  const translatedLines = translatedText.split('\n');

  // If line counts don't match, try to restore structure
  if (originalLines.length !== translatedLines.length) {
    // Try to restore line breaks by matching patterns
    return restoreLineBreaks(originalText, translatedText);
  }

  // Restore table structures
  let processed = restoreTableStructures(originalLines, translatedLines);
  
  // Restore separators and formatting markers
  processed = restoreFormattingMarkers(originalText, processed);

  return processed;
}

/**
 * Restore line breaks by analyzing original structure
 */
function restoreLineBreaks(originalText: string, translatedText: string): string {
  // Split by common separators to preserve structure
  const originalSections = originalText.split(/\n{2,}/);
  const translatedSections = translatedText.split(/\n{2,}/);
  
  if (originalSections.length === translatedSections.length) {
    return translatedSections.join('\n\n');
  }

  // If sections don't match, preserve original line breaks
  const originalLineCount = originalText.split('\n').length;
  const translatedWords = translatedText.split(/\s+/);
  const wordsPerLine = Math.ceil(translatedWords.length / originalLineCount);
  
  const restored: string[] = [];
  for (let i = 0; i < originalLineCount; i++) {
    const start = i * wordsPerLine;
    const end = Math.min(start + wordsPerLine, translatedWords.length);
    restored.push(translatedWords.slice(start, end).join(' '));
  }
  
  return restored.join('\n');
}

/**
 * Restore table structures by analyzing pipe characters and alignment
 */
function restoreTableStructures(originalLines: string[], translatedLines: string[]): string {
  const result: string[] = [];
  
  for (let i = 0; i < originalLines.length; i++) {
    const originalLine = originalLines[i];
    const translatedLine = translatedLines[i] || '';
    
    // Check if original line contains table structure
    if (originalLine.includes('|')) {
      // Try to restore table structure
      const restored = restoreTableLine(originalLine, translatedLine);
      result.push(restored);
    } else if (originalLine.trim().match(/^[-=]{3,}$/)) {
      // Preserve separator lines
      result.push(originalLine);
    } else {
      result.push(translatedLine);
    }
  }
  
  return result.join('\n');
}

/**
 * Restore a single table line with proper alignment
 */
function restoreTableLine(originalLine: string, translatedLine: string): string {
  // Extract column structure from original (including empty columns)
  const originalParts = originalLine.split('|');
  const originalColumns = originalParts.map(col => col.trim());
  
  // Check if this is a separator row (all dashes)
  if (originalLine.match(/^\s*\|[\s|-]+\|\s*$/)) {
    // Preserve separator structure
    const dashCounts = originalColumns.map(col => {
      if (col.match(/^-+$/)) return col.length;
      return 0;
    });
    
    // Reconstruct separator with same structure
    const separatorParts = dashCounts.map(count => count > 0 ? '-'.repeat(Math.max(3, count)) : '');
    return '| ' + separatorParts.join(' | ') + ' |';
  }
  
  // If translated line doesn't have pipes, try to reconstruct based on original structure
  if (!translatedLine.includes('|')) {
    // Try to intelligently split translated text
    const words = translatedLine.trim().split(/\s+/);
    
    // Estimate words per column based on original column lengths
    const totalOriginalChars = originalColumns.reduce((sum, col) => sum + col.length, 0);
    const reconstructed: string[] = [];
    
    let wordIndex = 0;
    for (let i = 0; i < originalColumns.length; i++) {
      if (wordIndex >= words.length) {
        reconstructed.push('');
        continue;
      }
      
      // Estimate how many words should go in this column
      const originalRatio = originalColumns[i].length / Math.max(totalOriginalChars, 1);
      const wordsForColumn = Math.max(1, Math.ceil(words.length * originalRatio));
      
      const columnWords = words.slice(wordIndex, wordIndex + wordsForColumn);
      reconstructed.push(columnWords.join(' '));
      wordIndex += wordsForColumn;
    }
    
    // Add any remaining words to last column
    if (wordIndex < words.length && reconstructed.length > 0) {
      const remaining = words.slice(wordIndex).join(' ');
      reconstructed[reconstructed.length - 1] += ' ' + remaining;
    }
    
    // Pad columns to match original widths for better alignment
    const paddedColumns = reconstructed.map((col, idx) => {
      const targetWidth = Math.max(originalColumns[idx]?.length || 0, col.length);
      return col.padEnd(targetWidth);
    });
    
    return '| ' + paddedColumns.join(' | ') + ' |';
  }
  
  // If translated line has pipes, align them properly
  const translatedParts = translatedLine.split('|');
  const translatedColumns = translatedParts.map(col => col.trim());
  
  // Match column count - pad or truncate as needed
  const alignedColumns: string[] = [];
  const maxColumns = Math.max(originalColumns.length, translatedColumns.length);
  
  for (let i = 0; i < maxColumns; i++) {
    const origCol = originalColumns[i] || '';
    const transCol = translatedColumns[i] || '';
    
    // Use translated content but match original width for alignment
    const targetWidth = Math.max(origCol.length, transCol.length);
    alignedColumns.push(transCol.padEnd(targetWidth));
  }
  
  // Trim to match original column count
  const finalColumns = alignedColumns.slice(0, originalColumns.length);
  
  return '| ' + finalColumns.join(' | ') + ' |';
}

/**
 * Restore formatting markers like separators, dates, numbers
 */
function restoreFormattingMarkers(originalText: string, translatedText: string): string {
  let processed = translatedText;
  
  // Restore date patterns (preserve date format)
  const datePattern = /\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?/g;
  const originalDates = originalText.match(datePattern) || [];
  originalDates.forEach((date, idx) => {
    // Try to find corresponding date in translated text
    const translatedDates = processed.match(/\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?/g) || [];
    if (translatedDates[idx]) {
      // Keep original format if possible
      processed = processed.replace(translatedDates[idx], date);
    }
  });
  
  // Restore separator lines (dashes, equals, etc.)
  const separatorPattern = /^[-=]{3,}$/gm;
  const originalSeparators = originalText.match(separatorPattern) || [];
  originalSeparators.forEach((sep) => {
    // Find similar separator in translated text and replace with original
    const translatedSeparators = processed.match(/^[-=]{3,}$/gm) || [];
    const firstSep = translatedSeparators[0];
    if (firstSep) {
      processed = processed.replace(firstSep, sep);
    }
  });
  
  // Restore page markers
  const pagePattern = /(第\s*\d+\s*页\s*\/\s*共\s*\d+\s*页|Page\s*\d+\s*of\s*\d+)/gi;
  const originalPages = originalText.match(pagePattern) || [];
  originalPages.forEach((page) => {
    const translatedPages = processed.match(pagePattern) || [];
    const firstPage = translatedPages[0];
    if (firstPage) {
      // Keep page numbers from original
      processed = processed.replace(firstPage, page);
    }
  });
  
  return processed;
}

async function translateTextGoogle(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  domain?: DocumentDomain,
  trackUsage?: (event: TranslationUsageEvent) => void
): Promise<string> {
  try {
    // Handle auto-detect: pass undefined to let v3 auto-detect
    const sourceLang = sourceLanguage === 'auto' ? undefined : sourceLanguage;

    // Get glossary config for the domain (if glossary exists)
    let glossaryConfig: GlossaryConfig | undefined;
    if (domain && sourceLang) {
      const glossaryName = getGlossaryNameForDomain(domain);
      if (glossaryName) {
        glossaryConfig = {
          glossaryName,
          ignoreCase: true,
        };
      }
    }

    const [translatedText] = await translateTextV3(
      text,
      targetLanguage,
      sourceLang,
      'text/plain',
      glossaryConfig
    );

    const rawTranslation = translatedText || text;
    
    // Post-process to restore formatting and structure
    const processed = postProcessGoogleTranslation(text, rawTranslation);

    trackUsage?.({
      provider: 'google-translate',
      kind: 'text',
      inputChars: text.length,
      outputChars: processed.length,
    });
    
    return processed;
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
  domain: DocumentDomain,
  trackUsage?: (event: TranslationUsageEvent) => void
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI is not configured. Please set OPENAI_API_KEY.');
  }

  const system = getDomainSystemPrompt(domain);
  const terminologyGuidance = getDomainTerminologyGuidance(domain);
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
      '## CRITICAL: ALIGNED TABLES',
      '',
      '**ALL | CHARACTERS MUST ALIGN VERTICALLY!**',
      '',
      'CORRECT (columns align):',
      '| Course Name          | Credits | Grade |',
      '|----------------------|---------|-------|',
      '| English              | 4       | 72    |',
      '| Advanced Mathematics | 5       | 67    |',
      '',
      'HOW TO ALIGN:',
      '- Find longest text in each column',
      '- Pad ALL cells to match that width',
      '- Separator dashes match column width',
      '',
      '## MATCH ORIGINAL:',
      '- Same column count',
      '- Same row count',
      '',
      '## FOR FORMS:',
      '- "Label: Value" on separate lines',
      terminologyGuidance,
      '',
      'Output ONLY the translation.',
      '',
      'TEXT:',
      text,
    ].join('\n'),
  });

  const usage = (result as any)?.usage;
  const outputText = result.text || text;
  trackUsage?.({
    provider: 'openai',
    kind: 'text',
    model,
    inputChars: text.length,
    outputChars: outputText.length,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    totalTokens: usage?.totalTokens,
  });

  return result.text || text;
}

async function translateTextAnthropic(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  domain: DocumentDomain,
  trackUsage?: (event: TranslationUsageEvent) => void
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic is not configured. Please set ANTHROPIC_API_KEY.');
  }

  const system = getDomainSystemPrompt(domain);
  const terminologyGuidance = getDomainTerminologyGuidance(domain);
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
    '## CRITICAL: ALIGNED TABLES',
    '',
    '**ALL | CHARACTERS MUST ALIGN VERTICALLY!**',
    '',
    'CORRECT (columns align):',
    '| Course Name          | Credits | Grade |',
    '|----------------------|---------|-------|',
    '| English              | 4       | 72    |',
    '| Advanced Mathematics | 5       | 67    |',
    '',
    'HOW TO ALIGN:',
    '- Find longest text in each column',
    '- Pad ALL cells to match that width',
    '- Separator dashes match column width',
    '',
    '## MATCH ORIGINAL:',
    '- Same column count',
    '- Same row count',
    '',
    '## FOR FORMS:',
    '- "Label: Value" on separate lines',
    terminologyGuidance,
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
      const usage = (result as any)?.usage;
      const outputText = result.text || text;
      trackUsage?.({
        provider: 'anthropic',
        kind: 'text',
        model,
        inputChars: text.length,
        outputChars: outputText.length,
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
        totalTokens: usage?.totalTokens,
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
  openRouterModel?: string,
  trackUsage?: (event: TranslationUsageEvent) => void
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter is not configured. Please set OPENROUTER_API_KEY.');
  }

  const system = getDomainSystemPrompt(domain);
  const terminologyGuidance = getDomainTerminologyGuidance(domain);
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
      '## CRITICAL: PRODUCE PROPERLY ALIGNED TABLES',
      '',
      '**ALL | CHARACTERS MUST ALIGN VERTICALLY!**',
      '',
      'CORRECT FORMAT (notice alignment):',
      '| Course Name          | Credits | Grade | Type     | Date       |',
      '|----------------------|---------|-------|----------|------------|',
      '| English              | 4       | 72    | Required | 2000-01-13 |',
      '| Advanced Mathematics | 5       | 67    | Required | 2000-01-13 |',
      '| Physical Education   | 1       | 74    | Required | 2000-01-13 |',
      '',
      'HOW TO ALIGN:',
      '1. Find LONGEST text in each column',
      '2. Pad ALL cells in that column to match that width',
      '3. Use spaces for padding',
      '4. Separator dashes (---) must match column width',
      '',
      '## MATCH ORIGINAL:',
      '- Same number of COLUMNS',
      '- Same number of ROWS',
      '- Preserve side-by-side layouts',
      '',
      '## FOR SIDE-BY-SIDE:',
      '| Left Course          | Cr | Grade | Right Course         | Cr | Grade |',
      '|----------------------|----|-------|----------------------|----|-------|',
      '| English              | 4  | 72    | Physics              | 4  | 68    |',
      '',
      '## HEADER (before table):',
      'Student ID: XXXXX',
      'Name: XXXXX',
      '',
      '## FOOTER (after table):',
      'Total Credits: XXX',
      '',
      '## FOR FORMS:',
      '- "Label: Value" on separate lines',
      terminologyGuidance,
      '',
      'Output ONLY the translation.',
      '',
      'TEXT:',
      text,
    ].join('\n'),
  });

  clearTimeout(abortTimer);

  const usage = (result as any)?.usage;
  const outputText = result.text || text;
  trackUsage?.({
    provider: 'openrouter',
    kind: 'text',
    model,
    inputChars: text.length,
    outputChars: outputText.length,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
    totalTokens: usage?.totalTokens,
  });

  return result.text || text;
}

