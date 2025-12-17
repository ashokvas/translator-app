'use client';

import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';

/**
 * Component that syncs Clerk user data to Convex database
 * This ensures users are created/updated in the database when they sign in
 */
export function UserSync() {
  const { user, isLoaded } = useUser();
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Sync user to Convex database
    const syncUser = async () => {
      try {
        await createOrUpdateUser({
          clerkId: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: user.firstName || user.fullName || undefined,
          telephone: user.phoneNumbers[0]?.phoneNumber || undefined,
        });
      } catch (error) {
        console.error('Failed to sync user:', error);
      }
    };

    syncUser();
  }, [user, isLoaded, createOrUpdateUser]);

  return null;
}

