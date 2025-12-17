'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';

export function RoleRedirect() {
  const router = useRouter();
  const { isLoaded: clerkLoaded, user } = useUser();
  const [hasRedirected, setHasRedirected] = useState(false);
  
  // Pass Clerk ID directly to the query
  const userRole = useQuery(
    api.users.getCurrentUserRole,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  useEffect(() => {
    if (!clerkLoaded || !user) return;

    // If userRole is undefined, it's still loading
    if (userRole === undefined) {
      return;
    }

    // If userRole is null, user might not be in database yet
    // Wait a bit for UserSync to create the user
    if (userRole === null) {
      // Give UserSync time to create the user (max 5 seconds)
      const timeout = setTimeout(() => {
        if (!hasRedirected) {
          console.warn('User not found in database after 5 seconds, redirecting to user dashboard');
          router.push('/user');
          setHasRedirected(true);
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }

    // Prevent multiple redirects
    if (hasRedirected) return;

    // Redirect based on role
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    if (userRole.role === 'admin') {
      if (currentPath !== '/admin' && !currentPath.startsWith('/admin')) {
        console.log('Redirecting admin to /admin, role:', userRole.role);
        router.push('/admin');
        setHasRedirected(true);
      }
    } else {
      if (currentPath !== '/user' && !currentPath.startsWith('/user')) {
        console.log('Redirecting user to /user, role:', userRole.role);
        router.push('/user');
        setHasRedirected(true);
      }
    }
  }, [userRole, clerkLoaded, user, router, hasRedirected]);

  return null;
}


