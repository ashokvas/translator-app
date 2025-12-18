# Development Notes - Translator App

## Project Overview
Translation service app with admin/user roles, file uploads, Google Cloud Translation API integration, and automated document generation.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Auth**: Clerk
- **Backend**: Convex (BaaS)
- **Translation**: Google Cloud Translation API v2 + Vision API (OCR)
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

