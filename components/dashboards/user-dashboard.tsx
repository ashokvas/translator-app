'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';

export function UserDashboard() {
  const { user, isLoaded } = useUser();
  const userRole = useQuery(
    api.users.getCurrentUserRole,
    user?.id ? { clerkId: user.id } : 'skip'
  );
  const orders = useQuery(
    api.orders.getUserOrders,
    user?.id ? { clerkId: user.id } : 'skip'
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'orders'>('overview');

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/15 text-green-400';
      case 'processing':
        return 'bg-primary/15 text-primary';
      case 'paid':
        return 'bg-purple-500/15 text-purple-300';
      case 'quote_pending':
        return 'bg-purple-500/15 text-purple-300';
      case 'pending':
        return 'bg-yellow-500/15 text-yellow-300';
      case 'cancelled':
        return 'bg-red-500/15 text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'pending') return 'Payment required';
    if (status === 'quote_pending') return 'Quote pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">User Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome back, {user?.firstName || user?.emailAddresses[0]?.emailAddress}!
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/70'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'orders'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/70'
              }`}
            >
              Orders
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* User Info Card */}
            <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Email:</span> {user?.emailAddresses[0]?.emailAddress}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Role:</span>{' '}
                  <span className="px-2 py-1 bg-primary/15 text-primary rounded text-xs font-medium">
                    {userRole?.role || 'Loading...'}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/user/new-order"
                  className="block w-full bg-primary text-primary-foreground text-center px-4 py-2 rounded hover:opacity-90 transition-colors"
                >
                  New Translation Order
                </Link>
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Your Stats</h2>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Total Orders:</span>{' '}
                  {orders === undefined ? '...' : orders?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Pending Orders:</span>{' '}
                  {orders === undefined
                    ? '...'
                    : orders?.filter((o: any) => o.status === 'pending' || o.status === 'paid').length || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Orders</h2>
              <Link
                href="/user/new-order"
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-colors text-sm font-medium"
              >
                New Order
              </Link>
            </div>
            <div className="overflow-x-auto">
              {orders === undefined ? (
                <div className="p-6 text-center text-muted-foreground">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
                  <Link
                    href="/user/new-order"
                    className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90 transition-colors"
                  >
                    Place Your First Order
                  </Link>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Order Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Service
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Files
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Delivery
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {orders.map((order: any) => (
                      <tr key={order._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          {order.orderNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="capitalize font-medium text-foreground">
                            {(order as any).serviceType ? (order as any).serviceType.charAt(0).toUpperCase() + (order as any).serviceType.slice(1) : 'General'}
                          </span>
                          {(order as any).isRush === true && (
                            <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-orange-500/15 text-orange-400">
                              Rush
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {order.files.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {order.totalPages}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {order.status === 'quote_pending' ? 'Quote pending' : `$${order.amount.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {order.estimatedDeliveryDate
                            ? formatDate(order.estimatedDeliveryDate)
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/user/orders/${order._id}`}
                            className="text-primary hover:opacity-90"
                          >
                            View / Pay
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
