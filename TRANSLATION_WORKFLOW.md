# Translation Workflow Guide

## Complete Step-by-Step Process

### Step 1: Access Admin Dashboard
1. Log in as an admin user
2. Navigate to **Admin Dashboard**
3. Click on the **"Order Management"** tab

### Step 2: View Orders
- You'll see a list of all orders with:
  - Order number
  - Translation direction (source → target language)
  - Number of pages
  - Amount
  - Current status

### Step 3: Retrieve Files for Translation
1. Click **"View & Translate"** button on any order
2. The order details panel will open showing:
   - **Original Files** section with download links
   - File names, page counts, and source language
3. Click **"Download"** next to each file to retrieve it
4. Files are downloaded from Convex cloud storage

### Step 4: Translate Files
1. Translate the downloaded files using your preferred translation tool
2. Save translated files with appropriate names (e.g., `document_es.pdf` for Spanish translation)
3. Keep the files ready for upload

### Step 5: Upload Translated Files
1. In the order details panel, scroll to **"Upload Translated Files"** section
2. Click **"Choose Files"** or drag & drop translated files
3. Select all translated files (can be multiple files)
4. Click **"Upload Translations"** button
5. Files are automatically:
   - Uploaded to Convex cloud storage
   - Saved to the order with storage IDs
   - Linked to the original files
   - Order status updated to "completed"

### Step 6: Verify Upload
- After successful upload:
  - Translated files appear in the **"Translated Files"** section
  - Order status changes to **"completed"**
  - Users can now download translated files from their dashboard

## Technical Details

### File Retrieval
- **Query**: `getOrderWithFiles(orderId, clerkId)`
- **Returns**: Order with file URLs generated from storage IDs
- **Access**: Admin-only (verified by role check)

### File Storage
- **Original Files**: Stored in `order.files[]` with `storageId`
- **Translated Files**: Stored in `order.translatedFiles[]` with `storageId`
- **Storage Location**: Convex cloud storage
- **File URLs**: Generated dynamically from storage IDs

### File Upload Process
1. Files uploaded via `/api/upload` endpoint
2. Forwarded to Convex HTTP action `/uploadFile`
3. Files stored in Convex storage
4. Storage IDs returned and saved to order
5. Order updated with translated files array

## Database Structure

```typescript
order: {
  files: [
    {
      fileName: "document.pdf",
      fileUrl: "https://...",
      storageId: "j123...",  // Convex storage ID
      fileSize: 12345,
      pageCount: 17,
      fileType: "application/pdf"
    }
  ],
  translatedFiles: [
    {
      fileName: "document_es.pdf",
      fileUrl: "https://...",
      storageId: "j456...",  // Convex storage ID
      fileSize: 12345,
      fileType: "application/pdf",
      originalFileName: "document.pdf"  // Links to original
    }
  ]
}
```

## Troubleshooting

### Files Not Downloading?
- Check browser console for errors
- Verify admin role permissions
- Ensure Convex is running (`npx convex dev`)

### Upload Failing?
- Check file size limits
- Verify file format (PDF, images supported)
- Check browser console for error messages
- Ensure you're logged in as admin

### Files Not Showing?
- Refresh the page
- Check order status (should be "paid" or "processing")
- Verify storage IDs are present in database

