# Development Notes - Translator App

## Project Overview
Translation service app with admin/user roles, file uploads, Google Cloud Translation API integration, and automated document generation.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Auth**: Clerk
- **Backend**: Convex (BaaS)
- **Translation**: Google Cloud Translation API v3 + Vision API (OCR) via official SDKs
- **Payments**: PayPal
- **Styling**: Tailwind CSS, shadcn/ui components
- **File Processing**: pdf-parse, pdfjs-dist, @napi-rs/canvas, docx, LibreOffice

## Key Features Implemented

### Authentication & Authorization
- Clerk authentication with Next.js 16 (`proxy.ts` instead of `middleware.ts`)
- Role-based access control (admin/user)
- Separate dashboards for each role
- Admin can edit user details

### File Upload System
- Multiple file uploads (PDF, DOCX, XLSX, images)
- Drag-and-drop interface with previews
- 10MB file size limit
- Accurate page counting (including LibreOffice conversion for Office docs)
- Progress indicators
- Files stored in Convex cloud storage

### Order Management
- Users can create orders without immediate payment
- Admins can create orders on behalf of clients
- Order statuses: pending, paid, processing, completed, cancelled
- Email notifications (payment required, order confirmation)
- Language selection with flags (25 European languages + auto-detect)
- **Document quality selection** (High Quality / Standard Quality) for OCR optimization
- Pricing: $35 per page

### Translation Workflow (Admin)
1. Admin views order → clicks "View & Translate"
2. For each file → clicks "Translate" button
3. System processes file:
   - **PDFs with text**: Extract text page-by-page
   - **Scanned PDFs**: OCR each page with Google Vision API
   - **Images**: OCR with Google Vision API
   - **Office docs**: Convert to PDF, then process
4. Translation segments stored in Convex
5. Admin reviews in side-by-side interface
6. Admin can edit any segment
7. Admin clicks "Approve Translation"
8. System generates Word document with all translated pages
9. Document saved to order's translated files
10. Client can download from their dashboard

## Database Schema (Convex)

### users
- `clerkId`, `email`, `name`, `telephone`, `role`, `createdAt`, `updatedAt`
- Indexes: `by_clerk_id`, `by_email`

### orders
- `userId`, `clerkId`, `orderNumber`, `files[]`, `translatedFiles[]`
- `totalPages`, `amount`, `sourceLanguage`, `targetLanguage`
- `status`, `paymentId`, `paymentStatus`, `estimatedDeliveryDate`
- `createdAt`, `updatedAt`
- Indexes: `by_user_id`, `by_clerk_id`, `by_order_number`, `by_status`

### translations
- `orderId`, `fileName`, `fileIndex`, `segments[]`
- Each segment: `id`, `originalText`, `translatedText`, `isEdited`, `editedAt`, `pageNumber`, `order`
- `status`, `progress`, `sourceLanguage`, `targetLanguage`
- `createdAt`, `updatedAt`
- Indexes: `by_order_id`, `by_status`

## API Routes

### `/api/upload` (POST)
- Uploads files to Convex storage
- Counts pages (PDF, Office docs, images)
- Returns file metadata with storage IDs

### `/api/translate` (POST)
- Translates files using Google Cloud APIs
- Handles text PDFs, scanned PDFs (OCR), images (OCR), office docs
- Stores translation segments in Convex
- Real-time progress updates

### `/api/generate-translated-document` (POST)
- Generates Word document from translation segments
- Uploads to Convex storage
- Adds to order's translated files

### `/api/paypal/create-order` (POST)
- Creates PayPal payment order

### `/api/paypal/capture-order` (POST)
- Captures PayPal payment
- Updates order status to "paid"

### `/api/send-order-confirmation` (POST)
- Sends email notifications (payment required, order confirmation)

## Environment Variables Required

See `.env.example` for complete list:
- Clerk keys (auth)
- Convex URL (backend)
- PayPal Client ID (payments)
- Google Cloud API key + Project ID (translation/OCR)
- LibreOffice path (office doc processing)

## Known Issues & Solutions

### 1. Page Count Accuracy
- **Issue**: LibreOffice sometimes adds blank pages
- **Solution**: Heuristic checks last page for content, adjusts count

### 2. Scanned PDFs
- **Issue**: No text layer to extract
- **Solution**: OCR pipeline with pdfjs-dist + Google Vision API

### 3. Native Module Loading
- **Issue**: `@napi-rs/canvas` fails to load in Turbopack
- **Solution**: Added to `serverExternalPackages` in `next.config.ts`

### 4. Upload Progress
- **Issue**: Upload indicators stayed visible after completion
- **Solution**: Auto-remove from queue after 1.5s delay

## File Structure

```
app/
├── (auth)/              # Auth pages (sign-in, sign-up)
├── (dashboard)/         # Dashboard pages
│   ├── admin/          # Admin dashboard
│   └── user/           # User dashboard & orders
└── api/                # API routes
    ├── upload/
    ├── translate/
    ├── generate-translated-document/
    ├── paypal/
    └── send-order-confirmation/

components/
├── admin/              # Admin components
│   ├── admin-dashboard.tsx
│   ├── admin-order-form.tsx
│   ├── order-management.tsx
│   └── translation-review.tsx
├── dashboards/         # Dashboard components
├── orders/             # Order components
│   ├── file-upload.tsx
│   ├── new-order-form.tsx
│   ├── order-details.tsx
│   ├── paypal-button.tsx
│   └── user-orders.tsx
├── providers/          # Context providers
└── ui/                 # shadcn/ui components

convex/
├── schema.ts           # Database schema
├── users.ts            # User functions
├── orders.ts           # Order functions
├── translations.ts     # Translation functions
├── files.ts            # File storage functions
└── emails.ts           # Email functions

lib/
├── languages.ts        # Language definitions with flags
└── utils.ts            # Utility functions
```

## Development Commands

```bash
# Start Next.js dev server
npm run dev

# Start Convex dev server (separate terminal)
npx convex dev

# Build for production
npm run build

# Run linter
npm run lint
```

## Deployment Checklist

- [ ] Set up production environment variables
- [ ] Configure PayPal production credentials
- [ ] Set up email service (Resend/SendGrid)
- [ ] Configure Google Cloud API quotas
- [ ] Test all user flows
- [ ] Test admin translation workflow
- [ ] Verify file upload limits
- [ ] Test payment processing
- [ ] Deploy to Vercel
- [ ] Configure Convex production deployment

## Next Steps / Future Features

1. **Email Integration**: Replace console.log with real email service
2. **PDF Format Preservation**: Maintain original PDF layout in translations
3. **Batch Translation**: Translate multiple files at once
4. **Translation Memory**: Store common translations for reuse
5. **User Notifications**: Real-time notifications for order status
6. **Admin Analytics**: Dashboard with order statistics
7. **File Compression**: Optimize storage usage
8. **Export Options**: Multiple format exports (PDF, TXT, etc.)

## Important Notes

- All API keys must be in `.env.local` (never commit this file)
- LibreOffice required for accurate DOCX/XLSX page counts
- Google Cloud billing must be enabled for Translation/Vision APIs
- Convex has no auth provider configured (intentional for file uploads)
- Orders created without payment have "pending" status
- Translation segments are editable and auto-saved
- Generated Word documents include all translated pages in sequence

## Google Cloud API Configuration

### Translation API (v3 with Service Account, v2 with API Key)
The app supports both Google Cloud Translation API versions:

**Authentication Options:**

| Auth Method | API Version | Features |
|-------------|-------------|----------|
| Service Account | v3 (Advanced) | Best quality, glossary support, batch translation |
| API Key | v2 (Basic) | Good quality, simpler setup, no service account needed |

**v3 Benefits (requires service account):**
- Neural Machine Translation with improved accuracy
- Glossary support for consistent terminology
- Batch translation for better performance
- Document translation API (preserves formatting)
- Better language detection
- Custom model support

**v2 Fallback (works with API key):**
- Neural Machine Translation
- Auto language detection
- Works with just an API key (no service account needed)

**Required Environment Variables:**
```bash
# Option 1: Service Account (Recommended - enables v3)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Option 2: API Key only (Falls back to v2)
GOOGLE_CLOUD_API_KEY=your-api-key
```

**Important:** Translation v3 does NOT support API key authentication. If you only have `GOOGLE_CLOUD_API_KEY` set, the system automatically falls back to v2.

### Vision API (Latest SDK)
The app uses Google Cloud Vision API via the official `@google-cloud/vision` SDK.

**Features:**
- Document text detection (DOCUMENT_TEXT_DETECTION) for dense documents
- Text detection (TEXT_DETECTION) for sparse text/signs
- Handwriting recognition
- Multi-language support
- Layout analysis with bounding boxes

**Supported OCR Quality Modes:**
- `high`: Uses DOCUMENT_TEXT_DETECTION (better for documents, certificates)
- `low`: Uses TEXT_DETECTION (faster, better for simple images)

### SDK Files
- `lib/google-cloud.ts` - Client initialization and helper functions
- `lib/image-preprocessing.ts` - Image enhancement for OCR accuracy
- Singleton pattern for efficient client reuse
- Supports both API key and service account authentication

### Image Preprocessing for OCR
The app includes image preprocessing using Sharp to improve OCR accuracy on poor quality images.

**Preprocessing Steps:**
1. **Grayscale conversion** - Removes color noise
2. **Contrast enhancement** - Makes text stand out (1.3x default)
3. **Brightness adjustment** - Compensates for dark images
4. **Sharpening** - Improves edge definition for text
5. **Noise reduction** - Optional median filter for speckled images
6. **Histogram normalization** - Stretches contrast range
7. **Upscaling** - Optional 2x scaling for low-res images
8. **Binarization** - Optional black/white conversion for scanned docs

**Quality Presets:**
- `LIGHT_PREPROCESSING_OPTIONS` - Fast, minimal processing for good quality images
- `DEFAULT_PREPROCESSING_OPTIONS` - Balanced processing for most documents
- `AGGRESSIVE_PREPROCESSING_OPTIONS` - Heavy processing for poor quality images
- `SCANNED_DOCUMENT_OPTIONS` - Optimized for scanned documents with uneven lighting

**How it Works:**
- When OCR quality is set to "high", default preprocessing is applied
- When OCR quality is set to "low", light preprocessing is used (faster)
- Preprocessing happens before sending to Vision API
- If preprocessing fails, falls back to original image

## AI Translation Prompts

### Document Domain Types
The app supports specialized translation prompts for different document types:

- **General** - Letters, reports, articles, correspondence, business documents
- **Certificate/Official** - Certificates, diplomas, transcripts, academic records, vital records, licenses
- **Legal** - Contracts, agreements, court documents, affidavits, powers of attorney, corporate docs
- **Medical** - Clinical records, pharmaceutical documents, patient materials
- **Technical** - Engineering docs, software manuals, specifications

### Intelligent Document-Type Formatting
The prompts automatically adapt formatting based on document type:

| Document Type | Formatting Applied |
|---------------|-------------------|
| Forms/Certificates | "Label: Value" on separate lines |
| Contracts/Legal | Preserved clause numbering, indentation, hierarchy |
| Transcripts/Tables | Column alignment, row separation |
| Letters/Narrative | Paragraph flow, greeting/body/closing structure |
| Lists | Bullet points, numbering preserved |

### Core Formatting Rules (All Documents)
1. **Structure Preservation** - Mirror the source document's natural layout
2. **Intelligent Spacing** - Blank lines between major sections
3. **No Field Combining** - Never merge unrelated items with semicolons
4. **Date Format** - "Month Day, Year" (May 17, 1981)
5. **Numbers/IDs** - Preserved exactly as shown

### Domain-Specific Features

**Certificate/Official Documents:**
- Field-by-field formatting for short-form documents
- Transcript course/grade/credit alignment
- Vital records with separate date fields
- Official seal/stamp references

**Legal Documents:**
- Article/section/clause numbering preserved exactly
- Recitals (WHEREAS) and definitions formatted properly
- Party designations consistent throughout
- Signature blocks and attestation maintained

**General Documents:**
- Adapts to letter, report, or form format
- Maintains tone and register of original
- Preserves emphasis and structure

### Default Model
- OpenRouter with `openai/gpt-5.2` is the default for best quality
- Matches ChatGPT web application output format

## Troubleshooting

### Translation fails
- Check Google Cloud API keys in `.env.local`
- Verify APIs are enabled in Google Cloud Console
- Check billing is active

### File upload fails
- Check file size (max 10MB)
- Verify Convex is running (`npx convex dev`)
- Check browser console for errors

### LibreOffice errors
- Verify LibreOffice is installed
- Check `LIBREOFFICE_PATH` in `.env.local`
- Test: `which soffice` or `which libreoffice`

### Native binding errors
- Restart Next.js dev server after config changes
- Verify `serverExternalPackages` in `next.config.ts`
- Check `@napi-rs/canvas` is installed

## Contact & Support

Repository: https://github.com/ashokvas/translator-app

