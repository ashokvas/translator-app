import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const usageEventSchema = v.object({
  provider: v.string(),
  kind: v.union(v.literal("text"), v.literal("vision"), v.literal("ocr")),
  model: v.optional(v.string()),
  inputChars: v.optional(v.number()),
  outputChars: v.optional(v.number()),
  promptTokens: v.optional(v.number()),
  completionTokens: v.optional(v.number()),
  totalTokens: v.optional(v.number()),
  requests: v.optional(v.number()),
});

export const recordUsageEvents = mutation({
  args: {
    orderId: v.id("orders"),
    fileName: v.string(),
    clerkId: v.string(),
    events: v.array(usageEventSchema),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can record usage events");
    }

    const now = Date.now();
    for (const event of args.events) {
      await ctx.db.insert("translationUsage", {
        orderId: args.orderId,
        fileName: args.fileName,
        provider: event.provider,
        kind: event.kind,
        model: event.model,
        inputChars: event.inputChars,
        outputChars: event.outputChars,
        promptTokens: event.promptTokens,
        completionTokens: event.completionTokens,
        totalTokens: event.totalTokens,
        requests: event.requests,
        createdAt: now,
      });
    }

    return { recorded: args.events.length };
  },
});

export const getUsageByOrder = query({
  args: {
    orderId: v.id("orders"),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can view usage");
    }

    return ctx.db
      .query("translationUsage")
      .withIndex("by_order_id", (q) => q.eq("orderId", args.orderId))
      .order("desc")
      .collect();
  },
});
