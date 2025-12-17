'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function HeaderNav() {
  const { user } = useUser();
  const userRole = useQuery(
    api.users.getCurrentUserRole,
    user?.id ? { clerkId: user.id } : 'skip'
  );

  return (
    <div className="flex items-center gap-4">
      {userRole?.role === 'admin' ? (
        <>
          <Link
            href="/admin"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Admin Dashboard
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/user/new-order"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            New Order
          </Link>
          <Link
            href="/user"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Dashboard
          </Link>
        </>
      )}
    </div>
  );
}

