'use client';

import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function AuthExample() {
  const { user, isLoaded } = useUser();
  const convexUserId = useQuery(api.auth.currentUser);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-2">Authentication Status</h2>
      {user ? (
        <div>
          <p>Clerk User: {user.emailAddresses[0]?.emailAddress}</p>
          <p>Convex User ID: {convexUserId ?? 'Not authenticated'}</p>
        </div>
      ) : (
        <p>Not signed in</p>
      )}
    </div>
  );
}


