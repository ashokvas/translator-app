import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { UserSync } from '@/components/auth/user-sync';
import { RoleRedirect } from '@/components/auth/role-redirect';
import { RoleDebug } from '@/components/debug/role-debug';

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Translator App</h1>
          <p className="text-gray-600 mb-8">Please sign in to continue</p>
        </div>
      </main>
    );
  }

  // For authenticated users, the RoleRedirect component will handle routing
  return (
    <>
      <UserSync />
      <RoleRedirect />
      <RoleDebug />
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <h1 className="text-4xl font-bold mb-4">Loading...</h1>
          <p className="text-gray-600 mb-4">Redirecting to your dashboard...</p>
          <p className="text-sm text-gray-400 mt-4">
            If this takes too long, check the browser console for errors
          </p>
          <p className="text-xs text-gray-300 mt-2">
            Check the debug panel in the bottom-right corner
          </p>
        </div>
      </main>
    </>
  );
}
