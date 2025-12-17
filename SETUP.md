# Quick Setup Guide

## Step 1: Initialize Convex

Run this command in your terminal:

```bash
npx convex dev
```

This will:
1. Ask you to sign in to Convex (or create an account)
2. Create a new Convex project (or connect to existing one)
3. Generate a deployment URL like `https://your-project.convex.cloud`
4. Start watching your Convex functions

**Copy the deployment URL** that appears in the terminal output.

## Step 2: Create .env.local file

Create a `.env.local` file in the root directory with:

```env
# Clerk Authentication (get these from https://dashboard.clerk.com/apps/[your-app]/api-keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Convex (paste the URL from Step 1)
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

## Step 3: Restart your dev server

After creating `.env.local`, restart your Next.js dev server:

```bash
npm run dev
```

The app should now work! If you see the "Convex Not Configured" message, make sure:
- The `.env.local` file exists
- The `NEXT_PUBLIC_CONVEX_URL` is set correctly
- You've restarted the dev server after creating the file

