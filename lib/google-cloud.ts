/**
 * Google Cloud API Clients
 *
 * This module provides initialized clients for Google Cloud Translation and Vision APIs.
 *
 * Authentication Strategy:
 * - Service Account (GOOGLE_APPLICATION_CREDENTIALS): Uses SDK for both v3 Translation and Vision
 * - API Key (GOOGLE_CLOUD_API_KEY): Uses REST API for both v2 Translation and Vision
 *
 * The module automatically detects which authentication is available and uses
 * the appropriate method.
 */

import { TranslationServiceClient } from '@google-cloud/translate';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import {
  preprocessImageForOCR,
  getPreprocessingOptionsForQuality,
  type PreprocessingOptions,
} from './image-preprocessing';

// Singleton instances (only used with service account)
let translationClient: TranslationServiceClient | null = null;
let visionClient: ImageAnnotatorClient | null = null;

/**
 * Check if service account credentials are configured
 */
export function hasServiceAccountCredentials(): boolean {
  return !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

/**
 * Check if API key is configured
 */
export function hasApiKey(): boolean {
  return !!process.env.GOOGLE_CLOUD_API_KEY;
}

/**
 * Get the authentication mode being used
 */
export function getAuthMode(): 'service_account' | 'api_key' | 'none' {
  if (hasServiceAccountCredentials()) return 'service_account';
  if (hasApiKey()) return 'api_key';
  return 'none';
}

/**
 * Get the Translation API version being used
 */
export function getTranslationApiVersion(): 'v3' | 'v2' | 'none' {
  if (hasServiceAccountCredentials()) return 'v3';
  if (hasApiKey()) return 'v2';
  return 'none';
}

/**
 * Get or create the Translation v3 client (service account only)
 */
function getTranslationClient(): TranslationServiceClient {
  if (!translationClient) {
    if (!hasServiceAccountCredentials()) {
      throw new Error(
        'Translation v3 SDK requires service account. Use translateTextV3() which handles fallback.'
      );
    }
    translationClient = new TranslationServiceClient();
  }
  return translationClient;
}

/**
 * Get or create the Vision API client (service account only)
 */
function getVisionClientSdk(): ImageAnnotatorClient {
  if (!visionClient) {
    if (!hasServiceAccountCredentials()) {
      throw new Error(
        'Vision SDK requires service account. Use performOCR() which handles fallback.'
      );
    }
    visionClient = new ImageAnnotatorClient();
  }
  return visionClient;
}

/**
 * Get the Google Cloud project ID for Translation v3 requests
 */
export function getProjectId(): string {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT_ID is required for Translation v3. Set it in your environment variables.'
    );
  }
  return projectId;
}

/**
 * Get the parent path for Translation v3 API calls
 */
function getTranslationParent(location = 'global'): string {
  return `projects/${getProjectId()}/locations/${location}`;
}

// ============================================================================
// TRANSLATION API
// ============================================================================

/**
 * Translate text using Google Cloud Translation v2 (REST API with API key)
 */
async function translateTextV2Rest(
  text: string | string[],
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('Google Cloud API key not configured. Set GOOGLE_CLOUD_API_KEY.');
  }

  const texts = Array.isArray(text) ? text : [text];
  const results: string[] = [];

  // v2 API has a limit of ~5000 characters per request, process individually
  for (const t of texts) {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: t,
          source: sourceLanguage || undefined,
          target: targetLanguage,
          format: 'text',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Translation API v2 error: ${error}`);
    }

    const data = await response.json();
    results.push(data.data?.translations?.[0]?.translatedText || t);
  }

  return results;
}

/**
 * Glossary configuration for domain-specific translations
 * To use glossaries:
 * 1. Create a CSV glossary file with term pairs
 * 2. Upload to Google Cloud Storage
 * 3. Create a glossary resource using createGlossary()
 * 4. Reference the glossary name in translation requests
 */
export interface GlossaryConfig {
  /** The glossary resource name (e.g., 'legal-terms', 'medical-terms') */
  glossaryName: string;
  /** Whether to ignore the glossary for case differences */
  ignoreCase?: boolean;
}

/**
 * Get the full glossary resource path for Translation v3
 */
function getGlossaryPath(glossaryName: string, location = 'global'): string {
  return `projects/${getProjectId()}/locations/${location}/glossaries/${glossaryName}`;
}

/**
 * Create a glossary resource from a Cloud Storage file
 * The glossary file should be CSV format with header row specifying language codes
 * Example CSV:
 *   en,es
 *   certificate,certificado
 *   diploma,diploma
 *   transcript,expediente académico
 */
export async function createGlossary(
  glossaryName: string,
  gcsUri: string,
  sourceLanguageCode: string,
  targetLanguageCode: string,
  location = 'global'
): Promise<void> {
  if (!hasServiceAccountCredentials()) {
    throw new Error('Creating glossaries requires service account credentials');
  }

  const client = getTranslationClient();
  const parent = getTranslationParent(location);

  const glossary = {
    name: getGlossaryPath(glossaryName, location),
    languagePair: {
      sourceLanguageCode,
      targetLanguageCode,
    },
    inputConfig: {
      gcsSource: {
        inputUri: gcsUri,
      },
    },
  };

  const [operation] = await client.createGlossary({
    parent,
    glossary,
  });

  // Wait for the glossary creation to complete
  await operation.promise();
  console.log(`[Translation] Glossary '${glossaryName}' created successfully`);
}

/**
 * List available glossaries
 */
export async function listGlossaries(location = 'global'): Promise<string[]> {
  if (!hasServiceAccountCredentials()) {
    return [];
  }

  const client = getTranslationClient();
  const parent = getTranslationParent(location);

  const [glossaries] = await client.listGlossaries({ parent });
  return glossaries.map((g) => g.name || '').filter(Boolean);
}

/**
 * Check if a glossary exists
 */
export async function glossaryExists(glossaryName: string, location = 'global'): Promise<boolean> {
  if (!hasServiceAccountCredentials()) {
    return false;
  }

  try {
    const client = getTranslationClient();
    await client.getGlossary({ name: getGlossaryPath(glossaryName, location) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Translate text using Google Cloud Translation v3 (SDK with service account)
 * Supports glossaries for domain-specific terminology
 */
async function translateTextV3Sdk(
  text: string | string[],
  targetLanguage: string,
  sourceLanguage?: string,
  mimeType: 'text/plain' | 'text/html' = 'text/plain',
  glossaryConfig?: GlossaryConfig
): Promise<string[]> {
  const client = getTranslationClient();
  const parent = getTranslationParent();

  const contents = Array.isArray(text) ? text : [text];

  // Build the translation request
  const request: any = {
    parent,
    contents,
    targetLanguageCode: targetLanguage,
    sourceLanguageCode: sourceLanguage || undefined,
    mimeType,
  };

  // Add glossary configuration if provided and glossary exists
  if (glossaryConfig?.glossaryName && sourceLanguage) {
    try {
      const exists = await glossaryExists(glossaryConfig.glossaryName);
      if (exists) {
        request.glossaryConfig = {
          glossary: getGlossaryPath(glossaryConfig.glossaryName),
          ignoreCase: glossaryConfig.ignoreCase ?? true,
        };
        console.log(`[Translation] Using glossary: ${glossaryConfig.glossaryName}`);
      }
    } catch (error) {
      console.warn(`[Translation] Glossary '${glossaryConfig.glossaryName}' not found, proceeding without`);
    }
  }

  const [response] = await client.translateText(request);

  // If glossary was used, prefer glossaryTranslation when available
  return response.translations?.map((t) => {
    if (t.glossaryTranslations?.[0]?.translatedText) {
      return t.glossaryTranslations[0].translatedText;
    }
    return t.translatedText || '';
  }) || contents;
}

/**
 * Get the recommended glossary name for a document domain
 * These glossaries must be created separately and uploaded to Cloud Storage
 */
export function getGlossaryNameForDomain(domain: string): string | undefined {
  const glossaryMap: Record<string, string> = {
    certificate: 'certificate-official-terms',
    legal: 'legal-terms',
    medical: 'medical-terms',
    technical: 'technical-terms',
    general: 'general-terms',
  };
  return glossaryMap[domain];
}

/**
 * Translate text using the best available API version
 *
 * - Uses v3 (SDK) if service account is configured (supports glossaries)
 * - Falls back to v2 (REST) if only API key is available (no glossary support)
 *
 * @param text - Text to translate
 * @param targetLanguage - Target language code
 * @param sourceLanguage - Source language code (optional, auto-detect if not provided)
 * @param mimeType - MIME type of the text
 * @param glossaryConfig - Optional glossary configuration for domain-specific terms
 */
export async function translateTextV3(
  text: string | string[],
  targetLanguage: string,
  sourceLanguage?: string,
  mimeType: 'text/plain' | 'text/html' = 'text/plain',
  glossaryConfig?: GlossaryConfig
): Promise<string[]> {
  const authMode = getAuthMode();

  if (authMode === 'service_account') {
    console.log('[Translation] Using Google Cloud Translation v3 (service account)');
    return translateTextV3Sdk(text, targetLanguage, sourceLanguage, mimeType, glossaryConfig);
  } else if (authMode === 'api_key') {
    console.log('[Translation] Using Google Cloud Translation v2 (API key)');
    // v2 API doesn't support glossaries
    if (glossaryConfig) {
      console.warn('[Translation] Glossaries not supported in v2 API, using standard translation');
    }
    return translateTextV2Rest(text, targetLanguage, sourceLanguage);
  } else {
    throw new Error(
      'Google Cloud Translation not configured. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS for v3, or GOOGLE_CLOUD_API_KEY for v2.'
    );
  }
}

/**
 * Detect language using Google Cloud Translation v3
 * Only available with service account authentication
 */
export async function detectLanguageV3(
  text: string
): Promise<{ languageCode: string; confidence: number }> {
  if (!hasServiceAccountCredentials()) {
    return { languageCode: 'und', confidence: 0 };
  }

  const client = getTranslationClient();
  const parent = getTranslationParent();

  const [response] = await client.detectLanguage({
    parent,
    content: text,
  });

  const detection = response.languages?.[0];
  return {
    languageCode: detection?.languageCode || 'und',
    confidence: detection?.confidence || 0,
  };
}

// ============================================================================
// VISION API (OCR)
// ============================================================================

/**
 * Perform OCR using Vision REST API (API key)
 */
async function performOcrRest(
  imageBuffer: Buffer,
  featureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION'
): Promise<{
  text: string;
  confidence: number;
  fullTextAnnotation?: any;
}> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('Google Cloud API key not configured. Set GOOGLE_CLOUD_API_KEY.');
  }

  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: featureType }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vision API error: ${error}`);
  }

  const data = await response.json();
  const result = data.responses?.[0] || {};

  const textAnnotations = result.textAnnotations || [];
  const fullText = textAnnotations[0]?.description || '';

  return {
    text: fullText.trim(),
    confidence: result.fullTextAnnotation?.pages?.[0]?.confidence || 0,
    fullTextAnnotation: result.fullTextAnnotation,
  };
}

/**
 * Perform OCR using Vision SDK (service account)
 */
async function performOcrSdk(
  imageBuffer: Buffer,
  featureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION'
): Promise<{
  text: string;
  confidence: number;
  fullTextAnnotation?: any;
}> {
  const client = getVisionClientSdk();

  const [result] = await client.annotateImage({
    image: { content: imageBuffer },
    features: [{ type: featureType }],
  });

  const textAnnotations = result.textAnnotations || [];
  const fullText = textAnnotations[0]?.description || '';

  return {
    text: fullText.trim(),
    confidence: result.fullTextAnnotation?.pages?.[0]?.confidence || 0,
    fullTextAnnotation: result.fullTextAnnotation,
  };
}

/**
 * Perform OCR using Google Cloud Vision API
 * Automatically uses SDK or REST based on authentication
 */
export async function performOCR(
  imageBuffer: Buffer,
  featureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION' = 'DOCUMENT_TEXT_DETECTION',
  preprocessingOptions?: PreprocessingOptions | 'auto' | 'none'
): Promise<{
  text: string;
  confidence: number;
  wasPreprocessed: boolean;
  pages: Array<{
    pageNumber: number;
    text: string;
    blocks: Array<{
      text: string;
      confidence: number;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
  }>;
}> {
  // Apply image preprocessing if requested
  let processedBuffer = imageBuffer;
  let wasPreprocessed = false;

  if (preprocessingOptions && preprocessingOptions !== 'none') {
    try {
      const options =
        preprocessingOptions === 'auto'
          ? await getPreprocessingOptionsForQuality('auto', imageBuffer)
          : preprocessingOptions;

      processedBuffer = await preprocessImageForOCR(imageBuffer, options);
      wasPreprocessed = true;
    } catch (error) {
      console.warn('[performOCR] Image preprocessing failed, using original:', error);
    }
  }

  // Choose API based on authentication
  const authMode = getAuthMode();
  let result: { text: string; confidence: number; fullTextAnnotation?: any };

  if (authMode === 'service_account') {
    console.log('[Vision] Using Vision SDK (service account)');
    result = await performOcrSdk(processedBuffer, featureType);
  } else if (authMode === 'api_key') {
    console.log('[Vision] Using Vision REST API (API key)');
    result = await performOcrRest(processedBuffer, featureType);
  } else {
    throw new Error(
      'Google Cloud Vision not configured. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_API_KEY.'
    );
  }

  // Parse fullTextAnnotation into structured pages
  const pages: Array<{
    pageNumber: number;
    text: string;
    blocks: Array<{
      text: string;
      confidence: number;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
  }> = [];

  const fullTextAnnotation = result.fullTextAnnotation;
  if (fullTextAnnotation?.pages) {
    fullTextAnnotation.pages.forEach((page: any, pageIndex: number) => {
      const pageBlocks: Array<{
        text: string;
        confidence: number;
        boundingBox?: { x: number; y: number; width: number; height: number };
      }> = [];

      let pageText = '';

      page.blocks?.forEach((block: any) => {
        let blockText = '';
        block.paragraphs?.forEach((paragraph: any) => {
          paragraph.words?.forEach((word: any) => {
            const wordText = word.symbols?.map((s: any) => s.text).join('') || '';
            blockText += wordText + ' ';
          });
          blockText += '\n';
        });

        blockText = blockText.trim();
        pageText += blockText + '\n\n';

        // Get bounding box
        const vertices = block.boundingBox?.vertices || [];
        let boundingBox: { x: number; y: number; width: number; height: number } | undefined;
        if (vertices.length >= 4) {
          const xs = vertices.map((v: any) => v.x || 0);
          const ys = vertices.map((v: any) => v.y || 0);
          boundingBox = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys),
          };
        }

        pageBlocks.push({
          text: blockText,
          confidence: block.confidence || 0,
          boundingBox,
        });
      });

      pages.push({
        pageNumber: pageIndex + 1,
        text: pageText.trim(),
        blocks: pageBlocks,
      });
    });
  }

  return {
    text: result.text,
    confidence: result.confidence,
    wasPreprocessed,
    pages,
  };
}

/**
 * Perform OCR from base64 encoded image
 */
export async function performOCRFromBase64(
  base64Image: string,
  featureType: 'TEXT_DETECTION' | 'DOCUMENT_TEXT_DETECTION' = 'DOCUMENT_TEXT_DETECTION',
  preprocessingOptions?: PreprocessingOptions | 'auto' | 'none'
): Promise<{
  text: string;
  confidence: number;
  wasPreprocessed: boolean;
  pages: Array<{
    pageNumber: number;
    text: string;
    blocks: Array<{
      text: string;
      confidence: number;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
  }>;
}> {
  const imageBuffer = Buffer.from(base64Image, 'base64');
  return performOCR(imageBuffer, featureType, preprocessingOptions);
}

/**
 * Get supported languages from Translation v3
 * Only available with service account authentication
 */
export async function getSupportedLanguages(
  displayLanguageCode = 'en'
): Promise<Array<{ code: string; name: string }>> {
  if (!hasServiceAccountCredentials()) {
    return [];
  }

  const client = getTranslationClient();
  const parent = getTranslationParent();

  const [response] = await client.getSupportedLanguages({
    parent,
    displayLanguageCode,
  });

  return (
    response.languages?.map((lang) => ({
      code: lang.languageCode || '',
      name: lang.displayName || lang.languageCode || '',
    })) || []
  );
}
