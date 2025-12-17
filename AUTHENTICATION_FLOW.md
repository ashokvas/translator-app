# Authentication Flow Guide

## Overview

This application uses a **single authentication system** for both users and admins, but routes them to **separate dashboards** based on their role after login.

## Key Points

✅ **Single Sign-Up/Sign-In**: Everyone uses the same Clerk authentication pages  
✅ **Role-Based Routing**: After login, users are automatically redirected to their dashboard  
✅ **Separate Dashboards**: 
   - Regular users → `/user` dashboard
   - Admins → `/admin` dashboard

---

## Step-by-Step Authentication Flow

### For New Users (Sign Up)

1. **Visit the Home Page** (`/`)
   - You'll see "Sign In" and "Sign Up" buttons in the header

2. **Click "Sign Up"**
   - Redirects to `/sign-up` page
   - Fill out the sign-up form (email, password, etc.)
   - Submit the form

3. **Account Created**
   - Clerk creates your authentication account
   - You're automatically signed in
   - The `UserSync` component creates your user record in Convex database
   - **Default role**: `"user"` (regular user)

4. **Automatic Redirect**
   - `RoleRedirect` component checks your role
   - Since you're a regular user → Redirected to `/user` dashboard

### For Existing Users (Sign In)

1. **Visit the Home Page** (`/`)
   - Click "Sign In" button in the header

2. **Sign In Page** (`/sign-in`)
   - Enter your email and password
   - Click "Sign In"

3. **After Sign In**
   - `RoleRedirect` component checks your role from Convex database
   - **If role = "user"** → Redirected to `/user` dashboard
   - **If role = "admin"** → Redirected to `/admin` dashboard

---

## Dashboard Routes

### User Dashboard (`/user`)

**Who can access**: Users with role `"user"`

**Features**:
- View personal profile
- Access user-specific features
- Translation history (when implemented)
- User settings

**How to access**:
- Sign up as a new user (default role)
- Sign in as a regular user
- Direct URL: `http://localhost:3000/user`

### Admin Dashboard (`/admin`)

**Who can access**: Users with role `"admin"`

**Features**:
- View all users
- Manage user roles (promote users to admin)
- Admin statistics
- System management features

**How to access**:
- Sign in as a user with admin role
- Direct URL: `http://localhost:3000/admin` (will show "Access Denied" if not admin)

---

## Pages Structure

```
/ (Home)
├── Sign Out → Shows sign-in/sign-up buttons
└── Sign In → Redirects to appropriate dashboard

/sign-in
└── Clerk Sign In Page → After sign in → Redirects to dashboard based on role

/sign-up
└── Clerk Sign Up Page → After sign up → Creates user with "user" role → Redirects to /user

/user (User Dashboard)
└── Protected route → Only accessible to authenticated users
    └── Shows "Access Denied" if admin tries to access (shouldn't happen due to redirect)

/admin (Admin Dashboard)
└── Protected route → Only accessible to authenticated admins
    └── Shows "Access Denied" if regular user tries to access
```

---

## How Role-Based Routing Works

### 1. User Signs In/Up
```
User → Clerk Authentication → Success
```

### 2. User Record Created/Updated
```
UserSync Component → Creates/Updates user in Convex database
- clerkId: From Clerk
- email: From Clerk
- role: "user" (default) or "admin" (if previously set)
```

### 3. Role Check & Redirect
```
RoleRedirect Component:
├── Queries Convex for user role
├── If role === "admin" → Redirect to /admin
└── If role === "user" → Redirect to /user
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Home Page (/)                         │
│  ┌──────────┐              ┌──────────┐                 │
│  │ Sign In  │              │ Sign Up  │                 │
│  └────┬─────┘              └────┬──────┘                 │
│       │                        │                         │
│       ▼                        ▼                         │
│  ┌─────────┐            ┌──────────┐                    │
│  │/sign-in │            │ /sign-up │                    │
│  └────┬────┘            └────┬─────┘                    │
│       │                      │                           │
│       └──────────┬───────────┘                           │
│                  │                                       │
│                  ▼                                       │
│         ┌─────────────────┐                             │
│         │ Clerk Auth      │                             │
│         │ (Success)       │                             │
│         └────────┬────────┘                             │
│                  │                                       │
│                  ▼                                       │
│         ┌─────────────────┐                             │
│         │ UserSync        │                             │
│         │ Creates user in │                             │
│         │ Convex DB       │                             │
│         └────────┬────────┘                             │
│                  │                                       │
│                  ▼                                       │
│         ┌─────────────────┐                             │
│         │ RoleRedirect    │                             │
│         │ Checks role     │                             │
│         └────────┬────────┘                             │
│                  │                                       │
│        ┌─────────┴─────────┐                           │
│        │                    │                           │
│        ▼                    ▼                           │
│  ┌──────────┐        ┌──────────┐                       │
│  │ role:    │        │ role:    │                       │
│  │ "user"   │        │ "admin"  │                       │
│  └────┬─────┘        └────┬─────┘                       │
│       │                   │                             │
│       ▼                   ▼                             │
│  ┌──────────┐        ┌──────────┐                      │
│  │ /user    │        │ /admin   │                       │
│  │ Dashboard│        │ Dashboard│                       │
│  └──────────┘        └──────────┘                       │
└─────────────────────────────────────────────────────────┘
```

---

## Testing the Flow

### Test as Regular User

1. **Sign Up**:
   ```
   http://localhost:3000/sign-up
   ```
   - Create a new account
   - You'll be redirected to `/user` dashboard

2. **Sign Out**:
   - Click UserButton → Sign Out
   - You'll see the home page with sign-in buttons

3. **Sign In**:
   ```
   http://localhost:3000/sign-in
   ```
   - Sign in with your credentials
   - You'll be redirected to `/user` dashboard

### Test as Admin

1. **Set Yourself as Admin** (see `SETUP_ADMIN.md`):
   - Use Convex Dashboard to change your role to `"admin"`
   - Or use `adminSetup:makeAdminByEmail` function

2. **Sign In**:
   ```
   http://localhost:3000/sign-in
   ```
   - Sign in with your admin account
   - You'll be redirected to `/admin` dashboard

3. **Try Accessing User Dashboard**:
   ```
   http://localhost:3000/user
   ```
   - You'll be redirected back to `/admin` (due to RoleRedirect)

---

## Important Notes

### No Separate Sign-Up Pages

- **Everyone uses the same sign-up page** (`/sign-up`)
- The role is determined **after** account creation
- Default role is always `"user"`
- Admins are created by **promoting existing users** (not during sign-up)

### Role Assignment

- **During Sign-Up**: All users get `"user"` role by default
- **After Sign-Up**: Admins can promote users via `/admin` dashboard
- **Manual Setup**: First admin must be set via Convex Dashboard (see `SETUP_ADMIN.md`)

### Security

- All dashboard routes are **protected** (require authentication)
- Admin routes check role **server-side** and show "Access Denied" if not admin
- Role-based redirects happen **client-side** for better UX

---

## Quick Reference

| Action | Route | Who Can Access |
|--------|-------|----------------|
| Home Page | `/` | Everyone (public) |
| Sign Up | `/sign-up` | Everyone (public) |
| Sign In | `/sign-in` | Everyone (public) |
| User Dashboard | `/user` | Authenticated users with role "user" |
| Admin Dashboard | `/admin` | Authenticated users with role "admin" |

---

## Troubleshooting

### "Access Denied" on Admin Dashboard

- Check your role in Convex Dashboard → Data → Tables → users
- Make sure role is set to `"admin"` (not `"user"`)
- Refresh your browser

### Not Redirecting After Sign In

- Check browser console for errors
- Verify Convex is running (`npx convex dev`)
- Make sure `NEXT_PUBLIC_CONVEX_URL` is set in `.env.local`

### User Not Created in Convex

- Make sure you've signed in at least once
- Check that `UserSync` component is in your layout
- Verify Convex connection is working

---

## Summary

✅ **Single authentication system** - Everyone signs up/signs in the same way  
✅ **Role-based dashboards** - Automatic routing after login  
✅ **Separate user and admin experiences** - Different dashboards for different roles  
✅ **Secure** - All routes protected, role checks in place

The key difference is **not in how you sign up**, but **where you're sent after login** based on your role!

