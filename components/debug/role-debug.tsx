'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Debug component to check authentication status
 * Remove this in production
 */
export function RoleDebug() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const userRole = useQuery(
    api.users.getCurrentUserRole,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  // Only render after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !mounted) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 text-xs rounded-lg z-50 max-w-sm">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1">
        <div>
          <strong>Clerk Loaded:</strong> {isLoaded ? '✅' : '❌'}
        </div>
        <div>
          <strong>Clerk User ID:</strong> {user?.id || 'None'}
        </div>
        <div>
          <strong>Convex Role Query:</strong>{' '}
          {userRole === undefined
            ? '⏳ Loading...'
            : userRole === null
            ? '❌ Not Found'
            : `✅ ${userRole.role}`}
        </div>
        {userRole && (
          <>
            <div>
              <strong>Email:</strong> {userRole.email}
            </div>
            <div>
              <strong>Role:</strong> {userRole.role}
            </div>
          </>
        )}
        <div>
          <strong>Current Path:</strong> {pathname}
        </div>
      </div>
    </div>
  );
}

