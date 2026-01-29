import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get translation for a specific file in an order
 */
export const getTranslationByFile = query({
  args: {
    orderId: v.id("orders"),
    fileName: v.string(),
    clerkId: v.string(), // Admin's Clerk ID for authorization
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can view translations");
    }

    const translation = await ctx.db
      .query("translations")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .filter((q) => q.eq(q.field("fileName"), args.fileName))
      .first();

    return translation;
  },
});

/**
 * Get all translations for an order
 */
export const getTranslationsByOrder = query({
  args: {
    orderId: v.id("orders"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can view translations");
    }

    const translations = await ctx.db
      .query("translations")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .collect();

    return translations;
  },
});

/**
 * Create or update translation segments
 */
export const upsertTranslation = mutation({
  args: {
    orderId: v.id("orders"),
    fileName: v.string(),
    fileIndex: v.number(),
    translationProvider: v.optional(
      v.union(
        v.literal("google"),
        v.literal("openai"),
        v.literal("anthropic"),
        v.literal("openrouter")
      )
    ),
    documentDomain: v.optional(
      v.union(
        v.literal("general"),
        v.literal("certificate"),
        v.literal("legal"),
        v.literal("medical"),
        v.literal("technical")
      )
    ),
    openRouterModel: v.optional(v.string()),
    ocrQuality: v.optional(v.union(v.literal("low"), v.literal("high"), v.literal("enhanced"))),
    segments: v.array(
      v.object({
        id: v.string(),
        originalText: v.string(),
        translatedText: v.string(),
        isEdited: v.boolean(),
        editedAt: v.optional(v.number()),
        pageNumber: v.optional(v.number()),
        order: v.number(),
      })
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("translating"),
      v.literal("review"),
      v.literal("approved"),
      v.literal("completed")
    ),
    progress: v.number(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can manage translations");
    }

    // Check if translation already exists
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .filter((q) => q.eq(q.field("fileName"), args.fileName))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing translation
      const patch: {
        segments: typeof args.segments;
        status: typeof args.status;
        progress: number;
        updatedAt: number;
        translationProvider?: "google" | "openai" | "anthropic" | "openrouter";
        documentDomain?: "general" | "certificate" | "legal" | "medical" | "technical";
        openRouterModel?: string;
        ocrQuality?: "low" | "high" | "enhanced";
      } = {
        segments: args.segments,
        status: args.status,
        progress: args.progress,
        updatedAt: now,
      };

      if (args.translationProvider !== undefined) {
        patch.translationProvider = args.translationProvider;
      }
      if (args.documentDomain !== undefined) {
        patch.documentDomain = args.documentDomain;
      }
      if (args.openRouterModel !== undefined) {
        patch.openRouterModel = args.openRouterModel;
      }
      if (args.ocrQuality !== undefined) {
        patch.ocrQuality = args.ocrQuality;
      }

      await ctx.db.patch(existing._id, patch);
      return existing._id;
    } else {
      // Create new translation
      const translationId = await ctx.db.insert("translations", {
        orderId: args.orderId,
        fileName: args.fileName,
        fileIndex: args.fileIndex,
        translationProvider: args.translationProvider,
        documentDomain: args.documentDomain,
        openRouterModel: args.openRouterModel,
        ocrQuality: args.ocrQuality,
        segments: args.segments,
        status: args.status,
        progress: args.progress,
        sourceLanguage: args.sourceLanguage,
        targetLanguage: args.targetLanguage,
        createdAt: now,
        updatedAt: now,
      });
      return translationId;
    }
  },
});

/**
 * Update a single translation segment
 */
export const updateTranslationSegment = mutation({
  args: {
    translationId: v.id("translations"),
    segmentId: v.string(),
    translatedText: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can edit translations");
    }

    const translation = await ctx.db.get(args.translationId);
    if (!translation) {
      throw new Error("Translation not found");
    }

    // Update the specific segment
    const updatedSegments = translation.segments.map((segment) => {
      if (segment.id === args.segmentId) {
        return {
          ...segment,
          translatedText: args.translatedText,
          isEdited: segment.translatedText !== args.translatedText || segment.isEdited,
          editedAt: segment.translatedText !== args.translatedText ? Date.now() : segment.editedAt,
        };
      }
      return segment;
    });

    await ctx.db.patch(args.translationId, {
      segments: updatedSegments,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Approve translation (mark as approved and create version snapshot)
 */
export const approveTranslation = mutation({
  args: {
    translationId: v.id("translations"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can approve translations");
    }

    // Get the current translation
    const translation = await ctx.db.get(args.translationId);
    if (!translation) {
      throw new Error("Translation not found");
    }

    // Get the highest version number for this translation
    const existingVersions = await ctx.db
      .query("translationVersions")
      .withIndex("by_translation_id", (q) => q.eq("translationId", args.translationId))
      .collect();

    const versionNumber = existingVersions.length > 0
      ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1
      : 1;

    const now = Date.now();

    // Create a version snapshot
    const versionId = await ctx.db.insert("translationVersions", {
      translationId: args.translationId,
      versionNumber,
      segments: translation.segments,
      translationProvider: translation.translationProvider,
      documentDomain: translation.documentDomain,
      openRouterModel: translation.openRouterModel,
      ocrQuality: translation.ocrQuality,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      approvedBy: args.clerkId,
      approvedAt: now,
      createdAt: now,
    });

    // Update the translation record with approval status and reference to latest version
    await ctx.db.patch(args.translationId, {
      status: "approved",
      approvedAt: now,
      latestVersionId: versionId,
      updatedAt: now,
    });

    return { success: true, versionId, versionNumber };
  },
});

/**
 * Delete approved translation (admin only)
 */
export const deleteTranslation = mutation({
  args: {
    translationId: v.id("translations"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can delete translations");
    }

    const translation = await ctx.db.get(args.translationId);
    if (!translation) {
      throw new Error("Translation not found");
    }

    // Only allow deletion of approved translations
    if (translation.status !== "approved") {
      throw new Error("Only approved translations can be deleted");
    }

    // Delete the translation record
    await ctx.db.delete(args.translationId);

    return { success: true };
  },
});

/**
 * Update translation progress
 */
export const updateTranslationProgress = mutation({
  args: {
    translationId: v.id("translations"),
    progress: v.number(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("translating"),
        v.literal("review"),
        v.literal("approved"),
        v.literal("completed")
      )
    ),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can update translation progress");
    }

    const updates: {
      progress: number;
      status?: "pending" | "translating" | "review" | "approved" | "completed";
      updatedAt: number;
    } = {
      progress: args.progress,
      updatedAt: Date.now(),
    };

    if (args.status !== undefined) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.translationId, updates);

    return { success: true };
  },
});

/**
 * Get version history for a translation
 */
export const getTranslationVersions = query({
  args: {
    translationId: v.id("translations"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can view translation versions");
    }

    const versions = await ctx.db
      .query("translationVersions")
      .withIndex("by_translation_id", (q) => q.eq("translationId", args.translationId))
      .collect();

    // Sort by version number descending (newest first)
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  },
});

/**
 * Get a specific translation version
 */
export const getTranslationVersion = query({
  args: {
    versionId: v.id("translationVersions"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can view translation versions");
    }

    const version = await ctx.db.get(args.versionId);
    return version;
  },
});

/**
 * Restore a previous version (copy segments from version back to translation)
 */
export const restoreTranslationVersion = mutation({
  args: {
    translationId: v.id("translations"),
    versionId: v.id("translationVersions"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can restore translation versions");
    }

    // Get the version to restore
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }

    // Verify this version belongs to the translation
    if (version.translationId !== args.translationId) {
      throw new Error("Version does not belong to this translation");
    }

    // Update the translation with the version's segments
    await ctx.db.patch(args.translationId, {
      segments: version.segments,
      status: "review", // Set back to review status after restoring
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

