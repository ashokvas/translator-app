# Troubleshooting: Stuck on "Redirecting to your dashboard..."

## Problem

After logging in, you see "Loading... Redirecting to your dashboard..." but never get redirected.

## Common Causes & Solutions

### 1. User Not Found in Convex Database

**Symptom**: Debug panel shows "Convex Role Query: ❌ Not Found"

**Solution**:
1. Make sure you've signed in at least once (this creates your user record)
2. Check Convex Dashboard → Data → Tables → users
3. Verify your user exists with your email
4. If missing, sign out and sign in again to trigger UserSync

### 2. Clerk ID Mismatch

**Symptom**: User exists but role query returns null

**Check**:
1. In Convex Dashboard, look at your user record
2. Note the `clerkId` field value
3. In Clerk Dashboard, find your User ID
4. They should match (both should start with `user_`)

**If they don't match**:
- The `clerkId` in Convex might be wrong
- Delete your user record in Convex
- Sign out and sign in again to recreate it

### 3. Role Not Set Correctly

**Symptom**: Debug panel shows role as "user" but you set it to "admin"

**Solution**:
1. Go to Convex Dashboard → Data → Tables → users
2. Find your user record
3. Verify the `role` field shows `"admin"` (with quotes)
4. Make sure it's exactly `"admin"` not `admin` or `Admin`

### 4. Convex Authentication Not Working

**Symptom**: Convex queries fail silently

**Check**:
1. Open browser console (F12)
2. Look for errors related to Convex
3. Check Network tab for failed requests to Convex

**Solution**:
1. Verify `NEXT_PUBLIC_CONVEX_URL` is set in `.env.local`
2. Make sure Convex is running: `npx convex dev`
3. Check Convex Dashboard for any errors

### 5. Clerk JWT Template Not Set Up

**Symptom**: Authentication errors in console

**Solution**:
1. Go to Clerk Dashboard → JWT Templates
2. Make sure you have a template named `convex`
3. If missing, create it (see SETUP_ADMIN.md)

## Debug Steps

### Step 1: Check Debug Panel

Look at the bottom-right corner of the page. You should see:
- ✅ Clerk Loaded
- Your Clerk User ID
- Convex Role Query status
- Your current role (if found)

### Step 2: Check Browser Console

1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for:
   - Errors (red text)
   - Warnings (yellow text)
   - Log messages from RoleRedirect

### Step 3: Check Convex Dashboard

1. Go to Convex Dashboard → Data → Tables → users
2. Find your user record
3. Verify:
   - `clerkId` matches your Clerk User ID
   - `role` is set correctly (`"user"` or `"admin"`)
   - `email` matches your email

### Step 4: Manual Redirect Test

Try navigating directly:
- `http://localhost:3000/user` (for regular users)
- `http://localhost:3000/admin` (for admins)

If these work, the issue is with the redirect logic, not authentication.

## Quick Fixes

### Fix 1: Force User Recreation

1. Go to Convex Dashboard → Data → Tables → users
2. Delete your user record
3. Sign out of the app
4. Sign in again
5. Check if user is recreated with correct role

### Fix 2: Manual Role Update

1. Go to Convex Dashboard → Data → Tables → users
2. Find your user
3. Edit the `role` field
4. Set it to `"admin"` (with quotes)
5. Save
6. Refresh your browser

### Fix 3: Use Function to Set Role

1. Go to Convex Dashboard → Functions
2. Find `adminSetup:makeAdminByEmail`
3. Run it with your email
4. Refresh browser

## Still Not Working?

1. **Check all environment variables**:
   ```bash
   cat .env.local
   ```
   Make sure all required vars are set

2. **Restart everything**:
   ```bash
   # Stop Convex (Ctrl+C)
   # Stop Next.js (Ctrl+C)
   # Then restart:
   npx convex dev
   # In another terminal:
   npm run dev
   ```

3. **Clear browser cache**:
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Or clear browser cache completely

4. **Check Convex logs**:
   - In Convex Dashboard → Logs
   - Look for errors related to your queries

## Expected Behavior

When everything works correctly:

1. **Sign In** → Redirects to home page (`/`)
2. **Home Page** → Shows "Loading..." briefly
3. **UserSync** → Creates/updates user in Convex (happens in background)
4. **RoleRedirect** → Checks role and redirects:
   - If `role === "user"` → `/user`
   - If `role === "admin"` → `/admin`
5. **Dashboard** → Shows appropriate dashboard

Total time: Usually 1-3 seconds

## Getting Help

If none of these work, check:
1. Browser console for specific error messages
2. Convex Dashboard logs
3. Terminal output from `npx convex dev`
4. Terminal output from `npm run dev`

Share these error messages for more specific help!

