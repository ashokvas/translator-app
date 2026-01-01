'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';

/**
 * Component to assign admin role to a user
 * This should be used by an existing admin or during initial setup
 */
export function AssignAdmin() {
  const { user } = useUser();
  const allUsers = useQuery(
    api.users.getAllUsers,
    user?.id ? { clerkId: user.id } : 'skip'
  );
  const updateUserRole = useMutation(api.users.updateUserRole);
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  // First, ensure current user is in database
  const ensureCurrentUser = async () => {
    if (!user) return;
    
    try {
      await createOrUpdateUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        name: user.firstName || user.fullName || undefined,
        role: 'admin', // Set as admin during initial setup
      });
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleAssignAdmin = async () => {
    if (!selectedUserId) return;

    setIsUpdating(true);
    try {
      // Find user by email (assuming selectedUserId is email)
      const targetUser = allUsers?.find((u: any) => u.email === selectedUserId);
      if (targetUser) {
        await updateUserRole({
          userId: targetUser._id,
          role: 'admin',
        });
        setNotice({ title: 'Success', message: 'Admin role assigned successfully!' });
        setSelectedUserId('');
      } else {
        setNotice({ title: 'Not found', message: 'User not found.' });
      }
    } catch (error: any) {
      setNotice({
        title: 'Assign admin failed',
        message: error?.message ? String(error.message) : String(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
      <h2 className="text-xl font-bold mb-4">Assign Admin Role</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select User to Make Admin
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="">Select a user...</option>
            {allUsers
              ?.filter((u: any) => u.role === 'user')
              .map((u: any) => (
                <option key={u._id} value={u.email}>
                  {u.email} {u.name && `(${u.name})`}
                </option>
              ))}
          </select>
        </div>

        <button
          onClick={handleAssignAdmin}
          disabled={!selectedUserId || isUpdating}
          className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUpdating ? 'Assigning...' : 'Assign Admin Role'}
        </button>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Initial Setup:</strong> If you're setting up the first admin, you may need to
            manually update the database or use the Convex dashboard to set your user role to
            'admin'.
          </p>
        </div>
      </div>
    </div>
  );
}

