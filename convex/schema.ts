import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    email: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")), // User role
    name: v.optional(v.string()),
    telephone: v.optional(v.string()), // Phone number
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  orders: defineTable({
    userId: v.id("users"), // Reference to user
    clerkId: v.string(), // Clerk user ID for quick lookup
    orderNumber: v.string(), // Unique order number
    serviceType: v.optional(
      v.union(
        v.literal("certified"),
        v.literal("general"),
        v.literal("custom")
      )
    ), // Type of translation service (optional for backward compatibility)
    isRush: v.optional(v.boolean()), // Whether rush service (24-hour delivery) was requested (optional for backward compatibility)
    documentDomain: v.optional(
      v.union(
        v.literal("general"),
        v.literal("certificate"),
        v.literal("legal"),
        v.literal("medical"),
        v.literal("technical")
      )
    ), // Document type/domain selected by user
    remarks: v.optional(v.string()), // Special instructions or remarks from user
    files: v.array(
      v.object({
        fileName: v.string(),
        fileUrl: v.string(), // URL to stored file
        storageId: v.optional(v.id("_storage")), // Convex storage ID for original file (optional for backward compatibility)
        fileSize: v.number(), // Size in bytes
        pageCount: v.number(), // Number of pages in document
        fileType: v.string(), // MIME type
      })
    ),
    translatedFiles: v.optional(
      v.array(
        v.object({
          fileName: v.string(),
          fileUrl: v.string(), // URL to translated file
          storageId: v.optional(v.id("_storage")), // Convex storage ID for translated file (optional for backward compatibility)
          fileSize: v.number(),
          fileType: v.string(),
          originalFileName: v.string(), // Reference to original file
          translatedAt: v.optional(v.number()), // Timestamp when file was translated/generated
          versionNumber: v.optional(v.number()), // Version number for this translation (optional for backward compatibility)
        })
      )
    ),
    totalPages: v.number(), // Total pages across all files
    amount: v.number(), // Total amount in USD (for custom orders, 0 until admin sets quote)
    quoteAmount: v.optional(v.number()), // Admin-set quote amount for custom orders
    sourceLanguage: v.string(), // Source language code (may be 'auto' for auto-detect)
    detectedSourceLanguage: v.optional(v.string()), // Actual detected source language (populated when sourceLanguage is 'auto')
    targetLanguage: v.string(), // Target language code
    ocrQuality: v.optional(v.union(v.literal("low"), v.literal("high"), v.literal("enhanced"))), // OCR preprocessing quality for scanned/image documents
    status: v.union(
      v.literal("pending"),
      v.literal("quote_pending"), // Custom orders awaiting admin quote
      v.literal("paid"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    paymentId: v.optional(v.string()), // PayPal transaction ID
    paymentStatus: v.optional(v.string()), // PayPal payment status
    estimatedDeliveryDate: v.optional(v.number()), // Timestamp
    reminderCount: v.optional(v.number()), // Number of payment reminders sent (0-3)
    lastReminderSentAt: v.optional(v.number()), // Timestamp of last reminder
    finalNoticeSentAt: v.optional(v.number()), // Timestamp when final notice was sent
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_order_number", ["orderNumber"])
    .index("by_status", ["status"])
    .index("by_service_type", ["serviceType"]),

  // System settings (pricing configuration, etc.)
  settings: defineTable({
    key: v.string(), // Setting key (e.g., "pricing")
    value: v.any(), // Setting value (JSON object)
    updatedBy: v.optional(v.string()), // Clerk ID of admin who last updated
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Translation segments for review and editing
  translations: defineTable({
    orderId: v.id("orders"), // Reference to order
    fileName: v.string(), // Original file name
    fileIndex: v.number(), // Index of file in order.files array
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
        id: v.string(), // Unique segment ID
        originalText: v.string(), // Original text
        translatedText: v.string(), // Translated text (editable)
        isEdited: v.boolean(), // Whether admin has edited this segment
        editedAt: v.optional(v.number()), // Timestamp of last edit
        pageNumber: v.optional(v.number()), // Page number for PDFs
        order: v.number(), // Display order
      })
    ),
    status: v.union(
      v.literal("pending"), // Not started
      v.literal("translating"), // Translation in progress
      v.literal("review"), // Ready for review
      v.literal("approved"), // Admin approved
      v.literal("completed") // Finalized and exported
    ),
    progress: v.number(), // 0-100 percentage
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    approvedAt: v.optional(v.number()), // Timestamp when translation was approved
    latestVersionId: v.optional(v.id("translationVersions")), // Reference to the current approved version
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_id", ["orderId"])
    .index("by_status", ["status"]),

  // Version history for approved translations
  translationVersions: defineTable({
    translationId: v.id("translations"), // Reference to parent translation
    versionNumber: v.number(), // Sequential version number (1, 2, 3, ...)
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
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    approvedBy: v.string(), // Clerk ID of admin who approved this version
    approvedAt: v.number(), // Timestamp when this version was approved
    createdAt: v.number(),
  })
    .index("by_translation_id", ["translationId"])
    .index("by_translation_and_version", ["translationId", "versionNumber"]),

  translationUsage: defineTable({
    orderId: v.id("orders"),
    fileName: v.string(),
    provider: v.string(),
    kind: v.union(v.literal("text"), v.literal("vision"), v.literal("ocr")),
    model: v.optional(v.string()),
    inputChars: v.optional(v.number()),
    outputChars: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    requests: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_order_id", ["orderId"]),
});

