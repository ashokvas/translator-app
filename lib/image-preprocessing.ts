/**
 * Image Preprocessing for OCR
 *
 * This module provides image enhancement functions to improve OCR accuracy
 * for poor quality document images.
 *
 * Preprocessing steps:
 * 1. Grayscale conversion - Removes color noise
 * 2. Contrast enhancement - Makes text stand out
 * 3. Sharpening - Improves edge definition
 * 4. Noise reduction - Removes speckles
 * 5. Normalize - Stretches histogram for better contrast
 */

import sharp from 'sharp';

export interface PreprocessingOptions {
  /**
   * Enable grayscale conversion (recommended for documents)
   * @default true
   */
  grayscale?: boolean;

  /**
   * Contrast enhancement level (1.0 = no change, 1.5 = 50% more contrast)
   * @default 1.3
   */
  contrast?: number;

  /**
   * Brightness adjustment (-1 to 1, 0 = no change)
   * @default 0.1
   */
  brightness?: number;

  /**
   * Sharpening sigma (0 = no sharpening, higher = more sharp)
   * @default 1.5
   */
  sharpen?: number;

  /**
   * Noise reduction (median filter size, 0 = disabled)
   * Use 3 for light noise, 5 for heavy noise
   * @default 0
   */
  denoise?: number;

  /**
   * Enable histogram normalization for better contrast
   * @default true
   */
  normalize?: boolean;

  /**
   * Scale factor for upscaling low-res images (1 = no scaling)
   * Useful for small images - OCR works better on larger images
   * @default 1
   */
  scale?: number;

  /**
   * Target DPI for the output image (0 = keep original)
   * 300 DPI is optimal for OCR
   * @default 0
   */
  targetDpi?: number;

  /**
   * Apply adaptive thresholding for binarization (black & white)
   * Good for scanned documents with uneven lighting
   * @default false
   */
  binarize?: boolean;

  /**
   * Threshold value for binarization (0-255, 128 = middle)
   * Only used if binarize is true
   * @default 128
   */
  binarizeThreshold?: number;
}

/**
 * Default preprocessing options optimized for document OCR
 */
export const DEFAULT_PREPROCESSING_OPTIONS: PreprocessingOptions = {
  grayscale: true,
  contrast: 1.3,
  brightness: 0.1,
  sharpen: 1.5,
  denoise: 0,
  normalize: true,
  scale: 1,
  targetDpi: 0,
  binarize: false,
  binarizeThreshold: 128,
};

/**
 * Aggressive preprocessing for very poor quality images
 */
export const AGGRESSIVE_PREPROCESSING_OPTIONS: PreprocessingOptions = {
  grayscale: true,
  contrast: 1.5,
  brightness: 0.15,
  sharpen: 2.0,
  denoise: 3,
  normalize: true,
  scale: 2,
  targetDpi: 300,
  binarize: false,
  binarizeThreshold: 128,
};

/**
 * Light preprocessing for already decent quality images
 */
export const LIGHT_PREPROCESSING_OPTIONS: PreprocessingOptions = {
  grayscale: false,
  contrast: 1.1,
  brightness: 0,
  sharpen: 0.5,
  denoise: 0,
  normalize: false,
  scale: 1,
  targetDpi: 0,
  binarize: false,
  binarizeThreshold: 128,
};

/**
 * Preprocessing for scanned documents with uneven lighting
 */
export const SCANNED_DOCUMENT_OPTIONS: PreprocessingOptions = {
  grayscale: true,
  contrast: 1.4,
  brightness: 0.1,
  sharpen: 1.5,
  denoise: 3,
  normalize: true,
  scale: 1,
  targetDpi: 300,
  binarize: true,
  binarizeThreshold: 140,
};

/**
 * Preprocess an image buffer for improved OCR accuracy
 *
 * @param imageBuffer - The input image as a Buffer
 * @param options - Preprocessing options
 * @returns Preprocessed image as a Buffer (PNG format)
 */
export async function preprocessImageForOCR(
  imageBuffer: Buffer,
  options: PreprocessingOptions = DEFAULT_PREPROCESSING_OPTIONS
): Promise<Buffer> {
  const opts = { ...DEFAULT_PREPROCESSING_OPTIONS, ...options };

  let pipeline = sharp(imageBuffer);

  // Get metadata for scaling calculations
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  // Step 1: Scale up if needed (before other operations for better quality)
  if (opts.scale && opts.scale > 1) {
    const newWidth = Math.round(originalWidth * opts.scale);
    const newHeight = Math.round(originalHeight * opts.scale);
    pipeline = pipeline.resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3, // High-quality upscaling
      fit: 'fill',
    });
  }

  // Step 2: Convert to grayscale
  if (opts.grayscale) {
    pipeline = pipeline.grayscale();
  }

  // Step 3: Normalize histogram (stretch contrast)
  if (opts.normalize) {
    pipeline = pipeline.normalize();
  }

  // Step 4: Adjust contrast and brightness
  // Sharp uses linear: a * input + b, where a affects contrast and b affects brightness
  if (opts.contrast !== 1 || opts.brightness !== 0) {
    pipeline = pipeline.linear(
      opts.contrast || 1,
      (opts.brightness || 0) * 255 * (opts.contrast || 1)
    );
  }

  // Step 5: Apply sharpening
  if (opts.sharpen && opts.sharpen > 0) {
    pipeline = pipeline.sharpen({
      sigma: opts.sharpen,
      m1: 1.0, // Flat areas
      m2: 2.0, // Jagged areas (text edges)
    });
  }

  // Step 6: Denoise (median filter)
  if (opts.denoise && opts.denoise > 0) {
    pipeline = pipeline.median(opts.denoise);
  }

  // Step 7: Binarization (threshold to black & white)
  if (opts.binarize) {
    pipeline = pipeline.threshold(opts.binarizeThreshold || 128);
  }

  // Step 8: Set DPI metadata if specified
  if (opts.targetDpi && opts.targetDpi > 0) {
    pipeline = pipeline.withMetadata({
      density: opts.targetDpi,
    });
  }

  // Output as PNG (lossless) for best OCR quality
  return pipeline.png({ compressionLevel: 6 }).toBuffer();
}

/**
 * Preprocess a base64-encoded image for OCR
 *
 * @param base64Image - Base64 encoded image (without data URL prefix)
 * @param options - Preprocessing options
 * @returns Preprocessed image as base64 string
 */
export async function preprocessBase64ImageForOCR(
  base64Image: string,
  options: PreprocessingOptions = DEFAULT_PREPROCESSING_OPTIONS
): Promise<string> {
  const inputBuffer = Buffer.from(base64Image, 'base64');
  const outputBuffer = await preprocessImageForOCR(inputBuffer, options);
  return outputBuffer.toString('base64');
}

/**
 * Analyze image quality and suggest preprocessing options
 *
 * @param imageBuffer - The input image as a Buffer
 * @returns Suggested preprocessing options based on image analysis
 */
export async function analyzeImageAndSuggestPreprocessing(
  imageBuffer: Buffer
): Promise<{
  suggestedOptions: PreprocessingOptions;
  analysis: {
    width: number;
    height: number;
    isLowResolution: boolean;
    isGrayscale: boolean;
    hasAlpha: boolean;
    format: string;
  };
}> {
  const metadata = await sharp(imageBuffer).metadata();
  const stats = await sharp(imageBuffer).stats();

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const isLowResolution = width < 1000 || height < 1000;
  const isGrayscale = (metadata.channels as number | undefined) === 1;
  const hasAlpha = metadata.hasAlpha || false;
  const format = metadata.format || 'unknown';

  // Calculate if image has low contrast
  const channels = stats.channels || [];
  const avgStdDev =
    channels.reduce((sum, ch) => sum + (ch.stdev || 0), 0) / channels.length;
  const isLowContrast = avgStdDev < 50;

  // Determine suggested options
  let suggestedOptions: PreprocessingOptions;

  if (isLowResolution && isLowContrast) {
    suggestedOptions = { ...AGGRESSIVE_PREPROCESSING_OPTIONS };
  } else if (isLowResolution) {
    suggestedOptions = {
      ...DEFAULT_PREPROCESSING_OPTIONS,
      scale: 2,
    };
  } else if (isLowContrast) {
    suggestedOptions = {
      ...DEFAULT_PREPROCESSING_OPTIONS,
      contrast: 1.5,
      normalize: true,
    };
  } else {
    suggestedOptions = { ...LIGHT_PREPROCESSING_OPTIONS };
  }

  return {
    suggestedOptions,
    analysis: {
      width,
      height,
      isLowResolution,
      isGrayscale,
      hasAlpha,
      format,
    },
  };
}

/**
 * Get preprocessing options based on quality setting
 *
 * @param quality - 'low', 'high', or 'auto'
 * @param imageBuffer - Optional image buffer for 'auto' analysis
 */
export async function getPreprocessingOptionsForQuality(
  quality: 'low' | 'high' | 'auto',
  imageBuffer?: Buffer
): Promise<PreprocessingOptions> {
  switch (quality) {
    case 'low':
      return LIGHT_PREPROCESSING_OPTIONS;
    case 'high':
      return DEFAULT_PREPROCESSING_OPTIONS;
    case 'auto':
      if (imageBuffer) {
        const analysis = await analyzeImageAndSuggestPreprocessing(imageBuffer);
        return analysis.suggestedOptions;
      }
      return DEFAULT_PREPROCESSING_OPTIONS;
    default:
      return DEFAULT_PREPROCESSING_OPTIONS;
  }
}

