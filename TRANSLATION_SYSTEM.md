# Translation System Implementation

## Overview

A comprehensive translation workflow has been implemented that allows admins to translate documents using Google Cloud Translation API, review and edit translations, and approve them before finalizing orders.

## Features Implemented

### 1. **Translation Engine**
- **Google Cloud Translation API v2** integration
- **Image Translation**: OCR using Google Cloud Vision API + Translation
- **PDF Translation**: Text extraction + translation (page-by-page)
- **Document Translation**: Support for PDF, DOCX, XLSX (DOCX/XLSX extraction placeholder)
- **Parallel Processing**: Files processed concurrently
- **Real-time Progress**: Progress tracking with shadcn/ui Progress component

### 2. **Review & Edit Interface**
- **Side-by-side Comparison**: Original and translated text displayed side-by-side
- **In-place Editing**: Editable translated text using shadcn/ui Textarea
- **Change Highlighting**: Edited sections highlighted with different background colors
- **"Edited" Badges**: Visual indicators for modified segments
- **Auto-save**: Edits saved to Convex in real-time
- **Approve Button**: Prominent approve action using shadcn/ui Button
- **Retranslate Option**: Ability to retranslate individual files

### 3. **Workflow Integration**
- **Translate Button**: Each file in order has a "Translate" button
- **Status Tracking**: Translation status (pending, translating, review, approved, completed)
- **Progress Indicators**: Real-time progress bars during translation
- **Review Modal**: Full-screen modal for reviewing translations
- **Order Management**: Integrated into existing admin order management

## Database Schema

### New Table: `translations`
```typescript
{
  orderId: Id<"orders">,
  fileName: string,
  fileIndex: number,
  segments: Array<{
    id: string,
    originalText: string,
    translatedText: string,
    isEdited: boolean,
    editedAt?: number,
    pageNumber?: number,
    order: number
  }>,
  status: "pending" | "translating" | "review" | "approved" | "completed",
  progress: number, // 0-100
  sourceLanguage: string,
  targetLanguage: string,
  createdAt: number,
  updatedAt: number
}
```

## API Routes

### POST `/api/translate`
Translates a file using Google Cloud Translation API.

**Request Body:**
```json
{
  "orderId": "string",
  "fileName": "string",
  "fileIndex": number,
  "fileUrl": "string",
  "fileType": "string",
  "sourceLanguage": "string",
  "targetLanguage": "string"
}
```

**Response:**
```json
{
  "success": true,
  "segmentsCount": number,
  "message": "Translation completed successfully"
}
```

## Convex Functions

### Queries
- `getTranslationByFile` - Get translation for a specific file
- `getTranslationsByOrder` - Get all translations for an order

### Mutations
- `upsertTranslation` - Create or update translation segments
- `updateTranslationSegment` - Update a single segment's translated text
- `approveTranslation` - Mark translation as approved
- `updateTranslationProgress` - Update translation progress percentage

## Setup Instructions

### 1. Google Cloud Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable APIs**
   - Enable **Cloud Translation API**
   - Enable **Cloud Vision API** (for image OCR)

3. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Restrict the key to Translation API and Vision API

4. **Add to Environment Variables**
   Add to `.env.local`:
   ```env
   GOOGLE_CLOUD_API_KEY=your_api_key_here
   GOOGLE_CLOUD_PROJECT_ID=your_project_id_here
   ```

### 2. Install Dependencies (if needed)

The following packages are already included or will be needed:
- `pdf-parse` - Already installed
- Google Cloud APIs are accessed via REST (no additional packages needed)

### 3. Usage Flow

1. **Admin views order** → Clicks "View & Translate"
2. **For each file** → Clicks "Translate" button
3. **Translation starts** → Progress bar shows progress
4. **Translation completes** → "Review" button appears
5. **Admin clicks "Review"** → Side-by-side comparison opens
6. **Admin edits translations** → Changes saved automatically
7. **Admin clicks "Approve"** → Translation marked as approved
8. **Admin uploads final files** → Order can be completed

## Components Created

### `/components/admin/translation-review.tsx`
Main translation review interface with:
- Side-by-side text comparison
- Editable text areas
- Save/Cancel buttons
- Approve/Retranslate actions
- Progress indicators

### `/components/ui/textarea.tsx`
Textarea component for editing translations

### `/components/ui/badge.tsx`
Badge component for showing status indicators

### `/components/ui/button.tsx`
Button component with variants

## File Structure

```
app/api/translate/route.ts          # Translation API endpoint
convex/translations.ts              # Translation Convex functions
convex/schema.ts                    # Updated schema with translations table
components/admin/translation-review.tsx  # Review interface
components/admin/order-management.tsx    # Updated with translation workflow
```

## Translation Process Details

### Images (JPEG, PNG, WebP)
1. Fetch image from URL
2. Convert to base64
3. Send to Google Cloud Vision API for OCR
4. Extract text from OCR response
5. Translate text using Translation API
6. Store as single segment

### PDFs
1. Fetch PDF from URL
2. Extract text page-by-page using pdf-parse
3. Translate each page's text separately
4. Store as multiple segments (one per page)
5. Preserve page numbers for reference

### Office Documents (DOCX/XLSX)
- Currently returns placeholder
- TODO: Implement proper text extraction using:
  - `mammoth` for DOCX
  - `exceljs` for XLSX
- Then translate extracted text

## Status Flow

```
pending → translating → review → approved → completed
```

- **pending**: Translation not started
- **translating**: Translation in progress
- **review**: Ready for admin review
- **approved**: Admin approved translation
- **completed**: Finalized (when order is completed)

## Error Handling

- API errors are caught and displayed to admin
- Translation progress resets on error
- Failed translations can be retried
- Network errors show user-friendly messages

## Future Enhancements

1. **Document Format Preservation**
   - Export translated PDFs with original formatting
   - Preserve DOCX/XLSX structure

2. **Batch Translation**
   - Translate all files in order at once
   - Bulk approve functionality

3. **Translation Memory**
   - Store common translations
   - Suggest translations based on history

4. **Quality Checks**
   - Word count validation
   - Character limit checks
   - Language detection verification

5. **Export Options**
   - Download translated text as TXT
   - Export as formatted documents
   - Generate bilingual PDFs

## Notes

- Translation API has rate limits (check Google Cloud quotas)
- Large files may take several minutes to translate
- Progress updates are polled every second during translation
- Edits are saved immediately when admin clicks "Save"
- Approved translations can still be edited before order completion

