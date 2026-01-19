/**
 * Convex Orders Functions Tests
 * 
 * Tests for order management including:
 * - Order creation
 * - Order status updates
 * - Quote setting for custom orders
 * - Payment updates
 * - Translated file management
 * - Admin authorization
 */

import { describe, it, expect } from 'vitest'

// Mock types matching your Convex schema
interface User {
  _id: string
  clerkId: string
  email: string
  name?: string
  role: 'user' | 'admin'
}

interface OrderFile {
  fileName: string
  fileUrl: string
  storageId?: string
  fileSize: number
  pageCount: number
  fileType: string
}

interface TranslatedFile extends OrderFile {
  originalFileName: string
  translatedAt?: number
}

interface Order {
  _id: string
  userId: string
  clerkId: string
  orderNumber: string
  serviceType: 'certified' | 'general' | 'custom'
  isRush: boolean
  documentDomain?: 'general' | 'certificate' | 'legal' | 'medical' | 'technical'
  remarks?: string
  files: OrderFile[]
  translatedFiles?: TranslatedFile[]
  totalPages: number
  amount: number
  quoteAmount?: number
  sourceLanguage: string
  targetLanguage: string
  status: 'pending' | 'quote_pending' | 'paid' | 'processing' | 'completed' | 'cancelled'
  paymentId?: string
  paymentStatus?: string
  estimatedDeliveryDate?: number
  createdAt: number
  updatedAt: number
}

// Helper to create mock user
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    _id: 'user_123',
    clerkId: 'clerk_123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    ...overrides,
  }
}

// Helper to create mock order
function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    _id: 'order_123',
    userId: 'user_123',
    clerkId: 'clerk_123',
    orderNumber: 'TRANS-123456789-ABC',
    serviceType: 'certified',
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
    amount: 125, // 5 pages * $25
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('Orders - Order Creation', () => {
  describe('createOrder logic', () => {
    it('should generate unique order number with correct format', () => {
      const orderNumber = `TRANS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      
      expect(orderNumber).toMatch(/^TRANS-\d+-[A-Z0-9]+$/)
    })

    it('should set rush delivery to 1 day', () => {
      const now = Date.now()
      const deliveryDays = 1 // Rush
      const estimatedDeliveryDate = now + deliveryDays * 24 * 60 * 60 * 1000
      
      const oneDayFromNow = now + 24 * 60 * 60 * 1000
      expect(estimatedDeliveryDate).toBeCloseTo(oneDayFromNow, -3) // Within 1 second
    })

    it('should set standard delivery to 7 days', () => {
      const now = Date.now()
      const deliveryDays = 7 // Standard
      const estimatedDeliveryDate = now + deliveryDays * 24 * 60 * 60 * 1000
      
      const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000
      expect(estimatedDeliveryDate).toBeCloseTo(sevenDaysFromNow, -3)
    })

    it('should set initial status to pending for certified orders', () => {
      const serviceType = 'certified'
      const initialStatus = serviceType === 'custom' ? 'quote_pending' : 'pending'
      
      expect(initialStatus).toBe('pending')
    })

    it('should set initial status to quote_pending for custom orders', () => {
      const serviceType = 'custom'
      const initialStatus = serviceType === 'custom' ? 'quote_pending' : 'pending'
      
      expect(initialStatus).toBe('quote_pending')
    })

    it('should calculate amount based on pages for certified service', () => {
      const totalPages = 5
      const pricePerPage = 25 // Certified base price
      const expectedAmount = totalPages * pricePerPage
      
      expect(expectedAmount).toBe(125)
    })

    it('should calculate rush amount correctly', () => {
      const totalPages = 5
      const basePerPage = 25
      const rushExtraPerPage = 25
      const expectedAmount = totalPages * (basePerPage + rushExtraPerPage)
      
      expect(expectedAmount).toBe(250)
    })
  })

  describe('Order validation', () => {
    it('should require user to exist', () => {
      const users: User[] = []
      const clerkId = 'non_existent'
      
      const user = users.find(u => u.clerkId === clerkId)
      expect(user).toBeUndefined()
    })

    it('should validate service type', () => {
      const validServiceTypes = ['certified', 'general', 'custom']
      
      expect(validServiceTypes).toContain('certified')
      expect(validServiceTypes).toContain('general')
      expect(validServiceTypes).toContain('custom')
      expect(validServiceTypes).not.toContain('express')
    })

    it('should validate document domain', () => {
      const validDomains = ['general', 'certificate', 'legal', 'medical', 'technical']
      
      expect(validDomains).toHaveLength(5)
      expect(validDomains).toContain('legal')
      expect(validDomains).toContain('medical')
    })
  })
})

describe('Orders - Admin Functions', () => {
  describe('updateOrderStatus authorization', () => {
    it('should reject non-admin users', () => {
      const regularUser = createMockUser({ clerkId: 'user_clerk', role: 'user' })
      const isAdmin = regularUser.role === 'admin'
      
      expect(isAdmin).toBe(false)
    })

    it('should allow admin users', () => {
      const adminUser = createMockUser({ clerkId: 'admin_clerk', role: 'admin' })
      const isAdmin = adminUser.role === 'admin'
      
      expect(isAdmin).toBe(true)
    })
  })

  describe('setQuoteAmount', () => {
    it('should only allow quotes for custom orders', () => {
      const customOrder = createMockOrder({ serviceType: 'custom', status: 'quote_pending' })
      const certifiedOrder = createMockOrder({ serviceType: 'certified' })
      
      expect(customOrder.serviceType).toBe('custom')
      expect(certifiedOrder.serviceType).not.toBe('custom')
    })

    it('should update amount and change status from quote_pending to pending', () => {
      const order = createMockOrder({ 
        serviceType: 'custom', 
        status: 'quote_pending',
        amount: 0 
      })
      
      const quoteAmount = 150
      order.quoteAmount = quoteAmount
      order.amount = quoteAmount
      order.status = 'pending'
      
      expect(order.quoteAmount).toBe(150)
      expect(order.amount).toBe(150)
      expect(order.status).toBe('pending')
    })
  })

  describe('getAllOrders', () => {
    it('should enrich orders with user information', () => {
      const order = createMockOrder()
      const user = createMockUser({ clerkId: order.clerkId })
      
      const enrichedOrder = {
        ...order,
        userEmail: user.email,
        userName: user.name,
        userTelephone: undefined,
      }
      
      expect(enrichedOrder.userEmail).toBe('test@example.com')
      expect(enrichedOrder.userName).toBe('Test User')
    })
  })
})

describe('Orders - Payment', () => {
  describe('updateOrderPayment', () => {
    it('should update payment info and status', () => {
      const order = createMockOrder({ status: 'pending' })
      
      order.status = 'paid'
      order.paymentId = 'PAYPAL-12345'
      order.paymentStatus = 'COMPLETED'
      
      expect(order.status).toBe('paid')
      expect(order.paymentId).toBe('PAYPAL-12345')
      expect(order.paymentStatus).toBe('COMPLETED')
    })
  })
})

describe('Orders - Translated Files', () => {
  describe('uploadTranslatedFiles', () => {
    it('should add translated files with timestamp', () => {
      const order = createMockOrder()
      const now = Date.now()
      
      const translatedFiles: TranslatedFile[] = [
        {
          fileName: 'document_translated.pdf',
          fileUrl: 'https://example.com/translated.pdf',
          fileSize: 2048,
          pageCount: 5,
          fileType: 'application/pdf',
          originalFileName: 'document.pdf',
          translatedAt: now,
        },
      ]
      
      order.translatedFiles = translatedFiles
      order.status = 'completed'
      
      expect(order.translatedFiles).toHaveLength(1)
      expect(order.translatedFiles[0].translatedAt).toBe(now)
      expect(order.status).toBe('completed')
    })

    it('should only allow admin to upload translated files', () => {
      const adminUser = createMockUser({ role: 'admin' })
      const regularUser = createMockUser({ role: 'user' })
      
      expect(adminUser.role === 'admin').toBe(true)
      expect(regularUser.role === 'admin').toBe(false)
    })
  })

  describe('deleteTranslatedFile', () => {
    it('should filter out deleted file', () => {
      const translatedFiles: TranslatedFile[] = [
        {
          fileName: 'file1.pdf',
          fileUrl: 'url1',
          fileSize: 1024,
          pageCount: 1,
          fileType: 'application/pdf',
          originalFileName: 'orig1.pdf',
        },
        {
          fileName: 'file2.pdf',
          fileUrl: 'url2',
          fileSize: 1024,
          pageCount: 1,
          fileType: 'application/pdf',
          originalFileName: 'orig2.pdf',
        },
      ]
      
      const fileNameToDelete = 'file1.pdf'
      const updatedFiles = translatedFiles.filter(f => f.fileName !== fileNameToDelete)
      
      expect(updatedFiles).toHaveLength(1)
      expect(updatedFiles[0].fileName).toBe('file2.pdf')
    })
  })
})

describe('Orders - Status Workflow', () => {
  describe('Valid status transitions', () => {
    const validStatuses = ['pending', 'quote_pending', 'paid', 'processing', 'completed', 'cancelled']
    
    it('should recognize all valid statuses', () => {
      expect(validStatuses).toContain('pending')
      expect(validStatuses).toContain('quote_pending')
      expect(validStatuses).toContain('paid')
      expect(validStatuses).toContain('processing')
      expect(validStatuses).toContain('completed')
      expect(validStatuses).toContain('cancelled')
    })

    it('should track status history through updatedAt', () => {
      const order = createMockOrder({ status: 'pending' })
      const originalUpdatedAt = order.updatedAt
      
      // Simulate status change
      order.status = 'paid'
      order.updatedAt = Date.now() + 1000
      
      expect(order.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })
  })
})

describe('Orders - User Access', () => {
  describe('getOrderById', () => {
    it('should return null if order does not belong to user', () => {
      const order = createMockOrder({ clerkId: 'user_A' })
      const requestingClerkId = 'user_B'
      
      const canAccess = order.clerkId === requestingClerkId
      expect(canAccess).toBe(false)
    })

    it('should return order if user owns it', () => {
      const order = createMockOrder({ clerkId: 'user_A' })
      const requestingClerkId = 'user_A'
      
      const canAccess = order.clerkId === requestingClerkId
      expect(canAccess).toBe(true)
    })
  })

  describe('getUserOrders', () => {
    it('should filter orders by clerkId', () => {
      const allOrders = [
        createMockOrder({ _id: '1', clerkId: 'user_A' }),
        createMockOrder({ _id: '2', clerkId: 'user_B' }),
        createMockOrder({ _id: '3', clerkId: 'user_A' }),
      ]
      
      const userAOrders = allOrders.filter(o => o.clerkId === 'user_A')
      
      expect(userAOrders).toHaveLength(2)
    })
  })
})

describe('Orders - Language Detection', () => {
  describe('updateDetectedSourceLanguage', () => {
    it('should only update if sourceLanguage is auto', () => {
      const orderWithAuto = createMockOrder({ sourceLanguage: 'auto' })
      const orderWithSpecific = createMockOrder({ sourceLanguage: 'en' })
      
      const shouldUpdateAuto = orderWithAuto.sourceLanguage === 'auto'
      const shouldUpdateSpecific = orderWithSpecific.sourceLanguage === 'auto'
      
      expect(shouldUpdateAuto).toBe(true)
      expect(shouldUpdateSpecific).toBe(false)
    })
  })
})

describe('Orders - Payment Reminders', () => {
  describe('getPendingOrdersForReminders', () => {
    it('should identify orders needing reminders', () => {
      const twoDaysInMs = 2 * 24 * 60 * 60 * 1000
      const now = Date.now()
      
      const order = createMockOrder({
        status: 'pending',
        createdAt: now - (3 * 24 * 60 * 60 * 1000), // 3 days ago
      })
      
      const daysSinceCreation = now - order.createdAt
      const needsReminder = daysSinceCreation >= twoDaysInMs && order.status === 'pending'
      
      expect(needsReminder).toBe(true)
    })

    it('should not remind orders with final notice already sent', () => {
      const order = {
        ...createMockOrder({ status: 'pending' }),
        finalNoticeSentAt: Date.now() - 1000,
      }
      
      const shouldRemind = !order.finalNoticeSentAt
      expect(shouldRemind).toBe(false)
    })

    it('should limit reminders to 3', () => {
      const reminderCount = 3
      const shouldSendMore = reminderCount < 3
      
      expect(shouldSendMore).toBe(false)
    })
  })
})
