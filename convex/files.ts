import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate upload URL for file storage
 * This creates a temporary URL that the client can use to upload files directly to Convex
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Generate a URL for uploading a file to Convex storage
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get file URL from storage ID
 */
export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    return fileUrl;
  },
});

/**
 * Delete a file from storage
 */
export const deleteFile = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
    return { success: true };
  },
});

/**
 * Store file metadata after a successful upload to Convex storage
 */
export const storeFileMetadata = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    pageCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Optionally, you could store this metadata in a separate 'files' table
    // For now, we'll just return it to the client to be included in the order
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    return {
      fileName: args.fileName,
      fileUrl: fileUrl || "", // Use the actual URL from storage
      storageId: args.storageId.toString(), // Convert ID to string for JSON
      fileSize: args.fileSize,
      pageCount: args.pageCount,
      fileType: args.fileType,
    };
  },
});

