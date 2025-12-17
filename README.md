# Translator App

A modern translation application built with Next.js 16, Clerk authentication, and Convex.

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Clerk** - Authentication and user management
- **Convex** - Backend-as-a-Service
- **Tailwind CSS** - Styling

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Clerk account
- Convex account

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Clerk JWT Template for Convex:

In your Clerk Dashboard:
- Go to **JWT Templates** → **New template**
- Name it `convex`
- Token lifetime: Set as needed (default is fine)
- Signing algorithm: RS256
- Copy the template name (should be `convex`)

This template will be used by Convex to authenticate requests.

3. Set up environment variables:

Create a `.env.local` file in the root directory with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your_deploy_key_here
```

4. Initialize Convex:

```bash
npx convex dev
```

This will:
- Create a Convex project (if you don't have one)
- Generate the deployment URL
- Set up the Convex configuration

5. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   └── providers/         # Context providers
│       └── convex-provider.tsx
├── convex/                # Convex backend functions
│   ├── auth.ts           # Authentication queries
│   ├── http.ts           # HTTP actions for authentication
│   └── _generated/       # Auto-generated types
├── proxy.ts              # Clerk proxy middleware for route protection (Next.js 16)
└── package.json          # Dependencies

```

## Authentication

The app uses Clerk for authentication with Next.js 16 App Router. The `proxy.ts` file (using `clerkMiddleware()`) protects all routes except:
- `/` (home page)
- `/sign-in/*`
- `/sign-up/*`
- `/api/webhooks/*`

The layout includes Clerk's authentication components:
- `<SignInButton>` and `<SignUpButton>` for unauthenticated users
- `<UserButton>` for authenticated users

### User Roles

The application supports two user roles:
- **User**: Regular users with access to `/user` dashboard
- **Admin**: Administrators with access to `/admin` dashboard and user management

### Setting Up the First Admin

**Important**: Clerk manages authentication, but user roles are stored in the Convex database. You need to access the **Convex Dashboard** (not Clerk Dashboard) to set roles.

**Quick Steps:**
1. **Sign up/sign in** to your app via Clerk (this creates your user in Convex)
2. **Access Convex Dashboard**: 
   - Run `npx convex dev` in your terminal
   - Click the dashboard URL shown, or go to https://dashboard.convex.dev
3. **Update User Role**: 
   - Go to **Data** → **Tables** → **users**
   - Find your user record (by email)
   - Change the `role` field from `"user"` to `"admin"`
   - Save
4. **Refresh** your browser - you'll be redirected to `/admin` dashboard

**Alternative Methods:**
- Use the `admin-setup:makeAdminByEmail` mutation in Convex Dashboard Functions tab
- See `SETUP_ADMIN.md` for detailed instructions and troubleshooting

### Role-Based Routing

- After login, users are automatically redirected based on their role:
  - Regular users → `/user` dashboard
  - Admins → `/admin` dashboard
- The `RoleRedirect` component handles this automatically
- Admin routes are protected and will show an "Access Denied" message for non-admin users

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

Make sure to set up the following environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
- `CLERK_SECRET_KEY` - Your Clerk secret key
- `NEXT_PUBLIC_CONVEX_URL` - Your Convex deployment URL
- `CONVEX_DEPLOY_KEY` - Your Convex deploy key (optional, for deployments)

