import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * ONE-TIME SETUP: Make yourself an admin
 * 
 * This mutation allows you to set yourself as admin by providing your Clerk user ID.
 * Run this once through the Convex dashboard or via a script.
 * 
 * To find your Clerk user ID:
 * 1. Go to Clerk Dashboard → Users
 * 2. Click on your user
 * 3. Copy the User ID (starts with "user_")
 * 
 * Then call this mutation with your Clerk ID.
 */
export const makeAdmin = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Find the user by Clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(
        `User with Clerk ID ${args.clerkId} not found. Make sure you've signed in at least once so the user is created in the database.`
      );
    }

    // Update role to admin
    await ctx.db.patch(user._id, {
      role: "admin",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: `User ${user.email} is now an admin`,
    };
  },
});

/**
 * Alternative: Make yourself admin using your email
 * This is easier if you know your email address
 */
export const makeAdminByEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error(
        `User with email ${args.email} not found. Make sure you've signed in at least once.`
      );
    }

    await ctx.db.patch(user._id, {
      role: "admin",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: `User ${user.email} is now an admin`,
    };
  },
});

