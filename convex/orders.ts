import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

/**
 * Create a new order
 */
export const createOrder = mutation({
  args: {
    clerkId: v.string(),
    serviceType: v.union(
      v.literal("certified"),
      v.literal("general"),
      v.literal("custom")
    ),
    isRush: v.boolean(),
    documentDomain: v.optional(
      v.union(
        v.literal("general"),
        v.literal("certificate"),
        v.literal("legal"),
        v.literal("medical"),
        v.literal("technical")
      )
    ),
    remarks: v.optional(v.string()),
    files: v.array(
      v.object({
        fileName: v.string(),
        fileUrl: v.string(),
        storageId: v.optional(v.id("_storage")), // Convex storage ID for original file (optional for backward compatibility)
        fileSize: v.number(),
        pageCount: v.number(),
        fileType: v.string(),
      })
    ),
    totalPages: v.number(),
    amount: v.number(),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    ocrQuality: v.optional(v.union(v.literal("low"), v.literal("high"), v.literal("enhanced"))), // OCR preprocessing quality
  },
  handler: async (ctx, args) => {
    // Find user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Generate unique order number
    const orderNumber = `TRANS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const now = Date.now();
    // Rush orders: 1 day, Standard orders: 7 days
    const deliveryDays = args.isRush ? 1 : 7;
    const estimatedDeliveryDate = now + deliveryDays * 24 * 60 * 60 * 1000;

    // Determine initial status: custom orders start as quote_pending, others as pending
    const initialStatus = args.serviceType === "custom" ? "quote_pending" : "pending";

    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      clerkId: args.clerkId,
      orderNumber,
      serviceType: args.serviceType,
      isRush: args.isRush,
      documentDomain: args.documentDomain,
      remarks: args.remarks,
      files: args.files,
      totalPages: args.totalPages,
      amount: args.amount,
      sourceLanguage: args.sourceLanguage,
      targetLanguage: args.targetLanguage,
      ocrQuality: args.ocrQuality || "high", // Default to high quality
      status: initialStatus,
      estimatedDeliveryDate,
      createdAt: now,
      updatedAt: now,
    });

    return { orderId, orderNumber };
  },
});

/**
 * Update order payment status
 */
export const updateOrderPayment = mutation({
  args: {
    orderId: v.id("orders"),
    paymentId: v.string(),
    paymentStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      status: "paid",
      paymentId: args.paymentId,
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get orders for a user
 */
export const getUserOrders = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .order("desc")
      .collect();

    return orders;
  },
});

/**
 * Get order by ID
 */
export const getOrderById = query({
  args: {
    orderId: v.id("orders"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);

    if (!order || order.clerkId !== args.clerkId) {
      return null;
    }

    return order;
  },
});

/**
 * Get all orders (admin only) with user information
 */
export const getAllOrders = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can view all orders");
    }

    const orders = await ctx.db
      .query("orders")
      .order("desc")
      .collect();

    // Enrich orders with user information
    const ordersWithUsers = await Promise.all(
      orders.map(async (order) => {
        const orderUser = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", order.clerkId))
          .first();

        return {
          ...order,
          userEmail: orderUser?.email || "Unknown",
          userName: orderUser?.name || null,
          userTelephone: orderUser?.telephone || null,
        };
      })
    );

    return ordersWithUsers;
  },
});

/**
 * Set quote amount for custom order (admin only)
 */
export const setQuoteAmount = mutation({
  args: {
    orderId: v.id("orders"),
    quoteAmount: v.number(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can set quote amounts");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.serviceType !== "custom") {
      throw new Error("Quote amounts can only be set for custom orders");
    }

    // Update order with quote amount and change status from quote_pending to pending
    await ctx.db.patch(args.orderId, {
      quoteAmount: args.quoteAmount,
      amount: args.quoteAmount,
      status: "pending",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update order status (admin only)
 */
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can update order status");
    }

    await ctx.db.patch(args.orderId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Upload translated files for an order (admin only)
 */
export const uploadTranslatedFiles = mutation({
  args: {
    orderId: v.id("orders"),
    clerkId: v.string(),
    translatedFiles: v.array(
      v.object({
        fileName: v.string(),
        fileUrl: v.string(),
        storageId: v.optional(v.id("_storage")), // Optional for backward compatibility
        fileSize: v.number(),
        fileType: v.string(),
        originalFileName: v.string(),
        versionNumber: v.optional(v.number()), // Optional for backward compatibility
      })
    ),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can upload translated files");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Add translatedAt timestamp to each file
    const now = Date.now();
    const translatedFilesWithTimestamp = args.translatedFiles.map((file) => ({
      ...file,
      translatedAt: now,
    }));

    // Append new translated files to existing ones (keep all versions)
    const existingTranslatedFiles = order.translatedFiles || [];
    const mergedTranslatedFiles = [...existingTranslatedFiles, ...translatedFilesWithTimestamp];

    // Update order with merged translated files and mark as completed
    await ctx.db.patch(args.orderId, {
      translatedFiles: mergedTranslatedFiles,
      status: "completed",
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Delete a translated file from an order (admin only)
 */
export const deleteTranslatedFile = mutation({
  args: {
    orderId: v.id("orders"),
    fileName: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can delete translated files");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (!order.translatedFiles || order.translatedFiles.length === 0) {
      throw new Error("No translated files found");
    }

    // Filter out the file to delete
    const updatedTranslatedFiles = order.translatedFiles.filter(
      (file) => file.fileName !== args.fileName
    );

    // If storageId exists, delete from storage
    const fileToDelete = order.translatedFiles.find((f) => f.fileName === args.fileName);
    if (fileToDelete?.storageId) {
      try {
        await ctx.storage.delete(fileToDelete.storageId);
      } catch (error) {
        console.error("Failed to delete file from storage:", error);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Update order with remaining translated files
    await ctx.db.patch(args.orderId, {
      translatedFiles: updatedTranslatedFiles.length > 0 ? updatedTranslatedFiles : undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get order with file URLs (admin only)
 */
export const getOrderWithFiles = query({
  args: {
    orderId: v.id("orders"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can view order files");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    // Get file URLs from storage IDs
    const filesWithUrls = await Promise.all(
      order.files.map(async (file) => {
        // If storageId exists, get URL from storage, otherwise use existing fileUrl
        let fileUrl = file.fileUrl;
        if (file.storageId) {
          const storageUrl = await ctx.storage.getUrl(file.storageId);
          fileUrl = storageUrl || file.fileUrl;
        }
        return {
          ...file,
          fileUrl, // Use storage URL if available, otherwise use existing fileUrl
        };
      })
    );

    // Get translated file URLs if they exist
    let translatedFilesWithUrls = undefined;
    if (order.translatedFiles) {
      translatedFilesWithUrls = await Promise.all(
        order.translatedFiles.map(async (file) => {
          // If storageId exists, get URL from storage, otherwise use existing fileUrl
          let fileUrl = file.fileUrl;
          if (file.storageId) {
            const storageUrl = await ctx.storage.getUrl(file.storageId);
            fileUrl = storageUrl || file.fileUrl;
          }
          return {
            ...file,
            fileUrl,
          };
        })
      );
    }

    return {
      ...order,
      files: filesWithUrls,
      translatedFiles: translatedFilesWithUrls,
    };
  },
});

/**
 * Update detected source language (admin only)
 * Called when auto-detect is used and the actual language is determined during translation
 */
export const updateDetectedSourceLanguage = mutation({
  args: {
    orderId: v.id("orders"),
    detectedSourceLanguage: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can update detected source language");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Only update if source language was 'auto' and detected language is not already set
    if (order.sourceLanguage === "auto" && !order.detectedSourceLanguage) {
      await ctx.db.patch(args.orderId, {
        detectedSourceLanguage: args.detectedSourceLanguage,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Update order reminder tracking (internal - called by cron)
 */
export const updateOrderReminder = internalMutation({
  args: {
    orderId: v.id("orders"),
    reminderCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      reminderCount: args.reminderCount,
      lastReminderSentAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mark final notice as sent (internal - called by cron)
 */
export const markFinalNoticeSent = internalMutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      finalNoticeSentAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get pending orders that need payment reminders (internal - called by cron)
 */
export const getPendingOrdersForReminders = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;

    // Get all pending orders
    const pendingOrders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // Filter orders that need action
    const ordersNeedingAction = pendingOrders.filter((order) => {
      // Skip if final notice already sent
      if (order.finalNoticeSentAt) {
        return false;
      }

      const reminderCount = order.reminderCount || 0;
      const lastReminderSentAt = order.lastReminderSentAt || order.createdAt;

      // Check if 2 days have passed since last action
      const daysSinceLastAction = now - lastReminderSentAt;
      const shouldSendReminder = daysSinceLastAction >= twoDaysInMs;

      // Only send up to 3 reminders, then final notice
      return shouldSendReminder && reminderCount <= 3;
    });

    // Enrich with user information
    const ordersWithUsers = await Promise.all(
      ordersNeedingAction.map(async (order) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", order.clerkId))
          .first();

        return {
          ...order,
          userEmail: user?.email || null,
          userName: user?.name || null,
        };
      })
    );

    return ordersWithUsers;
  },
});