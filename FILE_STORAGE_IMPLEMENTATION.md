# File Storage Implementation

## Current Status: Files Are NOT Being Saved

**Important**: Files are currently **NOT being saved** to disk or cloud storage. They are:
- Processed in memory for page counting
- Metadata (filename, size, page count) is stored in Convex database
- **Actual file content is discarded after processing**

## Where Files Should Be Stored

### Option 1: Convex File Storage (Recommended)

Since you're already using Convex, this is the best option. Files will be stored in Convex's cloud storage.

**Location**: Convex cloud storage (managed by Convex)
**Access**: Via Convex-generated URLs
**Benefits**: 
- Integrated with your existing setup
- Automatic CDN
- Secure by default
- No additional service needed

### Option 2: Local Development Storage

For development/testing, you could store files locally:

**Location**: `public/uploads/` or `uploads/` folder in your project
**Note**: Not recommended for production

### Option 3: Cloud Storage Services

- **AWS S3**: `s3://your-bucket-name/orders/`
- **Cloudinary**: Cloudinary's CDN
- **Uploadthing**: Next.js-optimized storage

## Implementation Status

Currently, the `fileUrl` field in the database contains:
- `placeholder://filename.pdf` (not a real URL)

Files need to be uploaded to actual storage before creating the order.

## Next Steps

To implement file storage, you need to:

1. **Choose a storage solution** (Convex Storage recommended)
2. **Upload files to storage** before creating order
3. **Store the real file URL** in the database
4. **Update the upload flow** to handle file storage

See `FILE_STORAGE.md` for detailed implementation guide.

