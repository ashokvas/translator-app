'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import { OrderManagement } from '@/components/admin/order-management';
import { AdminOrderForm } from '@/components/admin/admin-order-form';
import { NoticeDialog, type NoticeState } from '@/components/ui/notice-dialog';

export function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const userRole = useQuery(
    api.users.getCurrentUserRole,
    user?.id ? { clerkId: user.id } : 'skip'
  );
  const allUsers = useQuery(
    api.users.getAllUsers,
    user?.id ? { clerkId: user.id } : 'skip'
  );
  const updateUserRole = useMutation(api.users.updateUserRole);
  const updateUserDetails = useMutation(api.users.updateUserDetails);

  const [updatingUserId, setUpdatingUserId] = useState<Id<'users'> | null>(null);
  const [editingUserId, setEditingUserId] = useState<Id<'users'> | null>(null);
  const [editFormData, setEditFormData] = useState<{
    email: string;
    name: string;
    telephone: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'orders' | 'new-order'>('users');
  type UserDoc = NonNullable<typeof allUsers>[number];
  const [notice, setNotice] = useState<NoticeState | null>(null);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Check if user is admin
  if (userRole?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const handleRoleChange = async (userId: Id<'users'>, newRole: 'user' | 'admin') => {
    setUpdatingUserId(userId);
    try {
      await updateUserRole({ userId, role: newRole });
    } catch (error) {
      console.error('Failed to update user role:', error);
      setNotice({ title: 'Update failed', message: 'Failed to update user role.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStartEdit = (user: UserDoc) => {
    setEditingUserId(user._id);
    setEditFormData({
      email: user.email,
      name: user.name || '',
      telephone: user.telephone || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = async (userId: Id<'users'>) => {
    if (!user?.id || !editFormData) return;

    setUpdatingUserId(userId);
    try {
      await updateUserDetails({
        userId,
        adminClerkId: user.id,
        email: editFormData.email,
        name: editFormData.name || undefined,
        telephone: editFormData.telephone || undefined,
      });
      setEditingUserId(null);
      setEditFormData(null);
    } catch (error) {
      console.error('Failed to update user details:', error);
      setNotice({
        title: 'Update failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NoticeDialog notice={notice} onClose={() => setNotice(null)} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome, {user?.firstName || user?.emailAddresses[0]?.emailAddress}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Order Management
            </button>
            <button
              onClick={() => setActiveTab('new-order')}
              className={`${
                activeTab === 'new-order'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              New Order
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <>
            {/* Admin Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {allUsers ? allUsers.length : '...'}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Admins</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {allUsers ? allUsers.filter((u: any) => u.role === 'admin').length : '...'}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Regular Users</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {allUsers ? allUsers.filter((u: any) => u.role === 'user').length : '...'}
                </p>
              </div>
            </div>

            {/* User Management Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Click "Edit" to modify user details. Changes are saved immediately.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Telephone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allUsers?.map((dbUser: any) => {
                      const isEditing = editingUserId === dbUser._id;
                      const isUpdating = updatingUserId === dbUser._id;

                      return (
                        <tr key={dbUser._id} className={isEditing ? 'bg-blue-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {isEditing && editFormData ? (
                              <input
                                type="email"
                                value={editFormData.email}
                                onChange={(e) =>
                                  setEditFormData({ ...editFormData, email: e.target.value })
                                }
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={isUpdating}
                              />
                            ) : (
                              <span className="text-gray-900">{dbUser.email}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {isEditing && editFormData ? (
                              <input
                                type="text"
                                value={editFormData.name}
                                onChange={(e) =>
                                  setEditFormData({ ...editFormData, name: e.target.value })
                                }
                                placeholder="Name (optional)"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={isUpdating}
                              />
                            ) : (
                              <span className="text-gray-900">{dbUser.name || '-'}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {isEditing && editFormData ? (
                              <input
                                type="tel"
                                value={editFormData.telephone}
                                onChange={(e) =>
                                  setEditFormData({ ...editFormData, telephone: e.target.value })
                                }
                                placeholder="Phone (optional)"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={isUpdating}
                              />
                            ) : (
                              <span className="text-gray-900">{dbUser.telephone || '-'}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isUpdating && !isEditing ? (
                              <span className="text-gray-500 text-xs">Updating...</span>
                            ) : (
                              <select
                                value={dbUser.role}
                                onChange={(e) =>
                                  handleRoleChange(dbUser._id, e.target.value as 'user' | 'admin')
                                }
                                className="border border-gray-300 rounded px-2 py-1 text-xs"
                                disabled={isEditing || isUpdating}
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSaveEdit(dbUser._id)}
                                  disabled={isUpdating}
                                  className="text-green-600 hover:text-green-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                  title="Save changes"
                                >
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={isUpdating}
                                  className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                  title="Cancel editing"
                                >
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(dbUser)}
                                disabled={isUpdating}
                                className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                title="Edit user details"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'orders' && <OrderManagement />}

        {activeTab === 'new-order' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
              <p className="mt-2 text-gray-600">
                Upload documents and create a translation order (No payment required for admin)
              </p>
            </div>
            <AdminOrderForm />
          </div>
        )}
      </div>
    </div>
  );
}

