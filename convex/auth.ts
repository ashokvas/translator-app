import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get the current user ID from the authentication token.
 * This query requires authentication via Clerk.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    return identity.tokenIdentifier;
  },
});

