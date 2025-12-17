'use client';

import { RoleRedirect } from '@/components/auth/role-redirect';

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleRedirect />
      {children}
    </>
  );
}

