import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Default pricing configuration
 */
const DEFAULT_PRICING = {
  certified: {
    basePerPage: 25,
    rushExtraPerPage: 25,
  },
  general: {
    basePerPage: 15,
    rushExtraPerPage: 15,
  },
};

/**
 * Get pricing settings
 */
export const getPricing = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "pricing"))
      .first();

    if (!setting) {
      // Return default pricing if not set
      return DEFAULT_PRICING;
    }

    return setting.value as typeof DEFAULT_PRICING;
  },
});

/**
 * Update pricing settings (admin only)
 */
export const updatePricing = mutation({
  args: {
    clerkId: v.string(),
    pricing: v.object({
      certified: v.object({
        basePerPage: v.number(),
        rushExtraPerPage: v.number(),
      }),
      general: v.object({
        basePerPage: v.number(),
        rushExtraPerPage: v.number(),
      }),
    }),
  },
  handler: async (ctx, args) => {
    // Check if user is admin
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can update pricing settings");
    }

    // Check if pricing setting exists
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "pricing"))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        value: args.pricing,
        updatedBy: args.clerkId,
        updatedAt: now,
      });
    } else {
      // Create new
      await ctx.db.insert("settings", {
        key: "pricing",
        value: args.pricing,
        updatedBy: args.clerkId,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});
