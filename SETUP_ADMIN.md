# Setting Up Your First Admin User

## Understanding the Two User Systems

1. **Clerk Dashboard** - Manages authentication (sign-in, sign-up, user accounts)
   - Access at: https://dashboard.clerk.com
   - This is where you see users who have signed up

2. **Convex Database** - Stores application data including user roles
   - Access at: https://dashboard.convex.dev (after running `npx convex dev`)
   - This is where the `users` table with roles is stored

## How It Works

When a user signs in via Clerk:
1. Clerk authenticates them
2. The `UserSync` component automatically creates/updates a record in the Convex `users` table
3. The Convex `users` table stores the role ("user" or "admin")

## Method 1: Using Convex Dashboard (Recommended)

### Step 1: Access Convex Dashboard

1. Make sure Convex is running:
   ```bash
   npx convex dev
   ```

2. The terminal will show a URL like:
   ```
   Dashboard URL: https://dashboard.convex.dev/team/[team]/project/[project]
   ```
   Click this URL or go to https://dashboard.convex.dev

3. Sign in with your Convex account

### Step 2: Sign In to Your App First

Before you can set yourself as admin, you need to:
1. Sign up/sign in to your Next.js app (via Clerk)
2. This creates your user record in the Convex `users` table

### Step 3: Update Your Role in Convex Dashboard

**Detailed Steps:**
1. In Convex Dashboard, go to **Data** → **Tables** → **users**
2. Find your user record (look for your email in the `email` column)
3. **Click on your user's row** to open the edit panel
   - Alternatively, look for an **Edit** button or **pencil icon**
   - Or **double-click** on the `role` field value
4. In the edit panel, find the `role` field (currently showing `"user"`)
5. **Change it to `"admin"`**:
   - If it's a text field: type `admin` or `"admin"`
   - If it's a dropdown: select `admin`
6. **Click Save** (or press Enter)
7. Verify the `role` column now shows `admin`

**Still having trouble?** See `EDIT_ROLE_GUIDE.md` for detailed visual instructions or use Method 2 below.

### Step 4: Refresh Your App

Refresh your browser, and you'll be redirected to `/admin` dashboard!

## Method 2: Using Convex Functions (Alternative)

### Step 1: Find Your Clerk User ID

1. Go to Clerk Dashboard: https://dashboard.clerk.com
2. Navigate to **Users**
3. Click on your user account
4. Copy the **User ID** (it starts with `user_`)

### Step 2: Run the Mutation

In the Convex Dashboard:
1. Go to **Functions** tab
2. Find `adminSetup:makeAdmin`
3. Click **Run**
4. Enter your Clerk User ID as the argument:
   ```json
   {
     "clerkId": "user_xxxxxxxxxxxxx"
   }
   ```
5. Click **Run**

Or use `adminSetup:makeAdminByEmail` with your email:
```json
{
  "email": "your-email@example.com"
}
```

## Method 3: Using the Admin Dashboard (After First Admin is Set)

Once you have at least one admin:
1. Sign in as that admin
2. Go to `/admin` dashboard
3. Use the user management table to assign admin roles to other users

## Troubleshooting

### "User not found" error

This means you haven't signed in to the app yet. The user record is only created when:
1. You sign up/sign in via Clerk
2. The `UserSync` component runs and creates the Convex user record

**Solution**: Sign in to your app first, then try setting yourself as admin.

### Can't access Convex Dashboard

Make sure:
1. You've run `npx convex dev` at least once
2. You're signed in to Convex with the same account
3. Your project is properly configured

### Role not updating

1. Make sure you've saved the changes in Convex Dashboard
2. Refresh your browser
3. Clear browser cache if needed

## Quick Reference

- **Clerk Dashboard**: https://dashboard.clerk.com (authentication)
- **Convex Dashboard**: https://dashboard.convex.dev (database)
- **User Table**: Convex Dashboard → Data → Tables → users
- **Role Field**: Change from `"user"` to `"admin"`

