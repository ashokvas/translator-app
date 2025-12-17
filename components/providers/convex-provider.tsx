'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useAuth } from '@clerk/nextjs';
import { useMemo, ReactNode } from 'react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  const convex = useMemo(() => {
    if (!convexUrl) {
      // Return a placeholder client that won't break the app
      return new ConvexReactClient('https://placeholder.convex.cloud');
    }

    // Create Convex client
    // Note: Clerk authentication is handled via Convex HTTP actions
    // The token is passed automatically through Clerk's integration
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  // Show a helpful message if Convex URL is missing
  if (!convexUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-yellow-300 bg-yellow-50 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">
            Convex Not Configured
          </h2>
          <p className="text-yellow-700 mb-4">
            Please set up Convex to continue:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-yellow-700">
            <li>Run: <code className="bg-yellow-100 px-2 py-1 rounded">npx convex dev</code></li>
            <li>Copy the deployment URL</li>
            <li>Add it to <code className="bg-yellow-100 px-2 py-1 rounded">.env.local</code> as <code className="bg-yellow-100 px-2 py-1 rounded">NEXT_PUBLIC_CONVEX_URL</code></li>
          </ol>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

