# Fix: Convex ArgumentValidationError

## Problem
Getting error: `ArgumentValidationError: Object contains extra field 'clerkId' that is not in the validator.`

This happens when Convex hasn't synced the latest code changes.

## Solution

### Step 1: Make sure Convex Dev Server is Running

In your terminal, you should see Convex running. If not, start it:

```bash
npx convex dev
```

### Step 2: Wait for Convex to Sync

Convex automatically watches for file changes and syncs them. You should see messages like:
- `Pushed 1 function`
- `Synced functions`

### Step 3: Check Terminal Output

Look for any errors in the Convex dev terminal. If you see errors, fix them first.

### Step 4: Hard Refresh Browser

After Convex syncs:
1. Hard refresh your browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Or clear browser cache

### Step 5: Verify the Fix

The error should be gone. If not, try:

1. **Stop Convex** (Ctrl+C in the terminal running `npx convex dev`)
2. **Restart Convex**:
   ```bash
   npx convex dev
   ```
3. **Wait for it to fully sync** (you'll see "Ready" message)
4. **Refresh browser**

## What Changed

The `getCurrentUserRole` query now requires a `clerkId` parameter:

```typescript
// Before (old version - causes error)
api.users.getCurrentUserRole()

// After (new version - correct)
api.users.getCurrentUserRole({ clerkId: user.id })
```

Convex needs to regenerate its types to recognize this change.

## Still Not Working?

1. Check that `convex/users.ts` has:
   ```typescript
   export const getCurrentUserRole = query({
     args: {
       clerkId: v.string(),
     },
     // ...
   });
   ```

2. Make sure Convex terminal shows no errors

3. Try deleting `.convex` folder and restarting:
   ```bash
   rm -rf .convex
   npx convex dev
   ```

