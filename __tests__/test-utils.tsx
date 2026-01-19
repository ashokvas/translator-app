import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Custom render function that wraps components with necessary providers
 * Add providers here as your app grows (e.g., ThemeProvider, ConvexProvider)
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  )
}

/**
 * Custom render function with providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with custom render
export { customRender as render }

/**
 * Helper to create mock Convex query results
 */
export function createMockQueryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
  }
}

/**
 * Helper to create mock Convex mutation
 */
export function createMockMutation() {
  return {
    mutate: vi.fn(),
    isLoading: false,
    error: null,
  }
}

/**
 * Helper to wait for async operations
 */
export async function waitForAsync(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'user_123',
  clerkId: 'clerk_user_123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

/**
 * Mock admin data for testing
 */
export const mockAdmin = {
  id: 'admin_123',
  clerkId: 'clerk_admin_123',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

/**
 * Mock order data for testing
 */
export const mockOrder = {
  _id: 'order_123',
  userId: 'user_123',
  clerkId: 'clerk_user_123',
  orderNumber: 'ORD-2024-001',
  serviceType: 'certified' as const,
  isRush: false,
  files: [
    {
      fileName: 'document.pdf',
      fileUrl: 'https://example.com/doc.pdf',
      fileSize: 1024,
      pageCount: 5,
      fileType: 'application/pdf',
    },
  ],
  totalPages: 5,
  amount: 99.99,
  sourceLanguage: 'en',
  targetLanguage: 'es',
  status: 'pending' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
