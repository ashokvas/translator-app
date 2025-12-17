import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get the current user's role from the database
 * This version uses Clerk ID passed from client
 */
export const getCurrentUserRole = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return null;
    }

    return {
      id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  },
});

/**
 * Get user by Clerk ID
 */
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    return user;
  },
});

/**
 * Create or update user in database
 * This is called when a user signs in for the first time
 */
export const createOrUpdateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    telephone: v.optional(v.string()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const now = Date.now();

    if (existingUser) {
      // Update existing user (but don't overwrite role if it's already set)
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name ?? existingUser.name,
        telephone: args.telephone ?? existingUser.telephone,
        updatedAt: now,
        // Only update role if explicitly provided
        ...(args.role !== undefined ? { role: args.role } : {}),
      });
      return existingUser._id;
    } else {
      // Create new user (default role is "user")
      const userId = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email,
        name: args.name,
        telephone: args.telephone,
        role: args.role ?? "user",
        createdAt: now,
        updatedAt: now,
      });
      return userId;
    }
  },
});

/**
 * Create a new client user (admin only)
 * This allows admins to create client records without Clerk authentication
 * Uses a temporary Clerk ID that can be linked later if the user signs up
 */
export const createClientUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    telephone: v.optional(v.string()),
    adminClerkId: v.string(), // Admin's Clerk ID for authorization
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can create client users");
    }

    // Check if user with this email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      // Return existing user's Clerk ID
      return { clerkId: existingUser.clerkId, userId: existingUser._id };
    }

    // Generate a temporary Clerk ID
    // Format: temp_<timestamp>_<random>
    const tempClerkId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const now = Date.now();

    // Create new user with temporary Clerk ID
    const userId = await ctx.db.insert("users", {
      clerkId: tempClerkId,
      email: args.email,
      name: args.name,
      telephone: args.telephone,
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    return { clerkId: tempClerkId, userId };
  },
});

/**
 * Update user role (admin only)
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .first();

    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can update user roles");
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update user details (admin only)
 */
export const updateUserDetails = mutation({
  args: {
    userId: v.id("users"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    telephone: v.optional(v.string()),
    adminClerkId: v.string(), // Admin's Clerk ID for authorization
  },
  handler: async (ctx, args) => {
    // Check if admin
    const admin = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can update user details");
    }

    // Get the user to update
    const userToUpdate = await ctx.db.get(args.userId);
    if (!userToUpdate) {
      throw new Error("User not found");
    }

    // Prepare update object
    const updates: {
      email?: string;
      name?: string;
      telephone?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.email !== undefined) {
      updates.email = args.email;
    }
    if (args.name !== undefined) {
      // Use undefined instead of null for empty strings (Convex doesn't accept null)
      updates.name = args.name || undefined;
    }
    if (args.telephone !== undefined) {
      // Use undefined instead of null for empty strings (Convex doesn't accept null)
      updates.telephone = args.telephone || undefined;
    }

    await ctx.db.patch(args.userId, updates);

    return { success: true };
  },
});

/**
 * Get all users (admin only)
 */
export const getAllUsers = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can view all users");
    }

    const users = await ctx.db.query("users").collect();
    return users;
  },
});
