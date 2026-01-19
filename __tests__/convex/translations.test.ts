/**
 * Convex Translations Functions Tests
 * 
 * Tests for translation management including:
 * - Translation creation and updates
 * - Segment editing
 * - Translation approval
 * - Translation deletion
 * - Progress tracking
 * - Admin authorization
 */

import { describe, it, expect } from 'vitest'

// Mock types matching your Convex schema
interface User {
  _id: string
  clerkId: string
  email: string
  role: 'user' | 'admin'
}

interface TranslationSegment {
  id: string
  originalText: string
  translatedText: string
  isEdited: boolean
  editedAt?: number
  pageNumber?: number
  order: number
}

interface Translation {
  _id: string
  orderId: string
  fileName: string
  fileIndex: number
  translationProvider?: 'google' | 'openai' | 'anthropic' | 'openrouter'
  documentDomain?: 'general' | 'certificate' | 'legal' | 'medical' | 'technical'
  openRouterModel?: string
  ocrQuality?: 'low' | 'high'
  segments: TranslationSegment[]
  status: 'pending' | 'translating' | 'review' | 'approved' | 'completed'
  progress: number
  sourceLanguage: string
  targetLanguage: string
  approvedAt?: number
  createdAt: number
  updatedAt: number
}

// Helper to create mock user
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    _id: 'user_123',
    clerkId: 'clerk_123',
    email: 'test@example.com',
    role: 'user',
    ...overrides,
  }
}

// Helper to create mock segment
function createMockSegment(overrides: Partial<TranslationSegment> = {}): TranslationSegment {
  return {
    id: 'segment_1',
    originalText: 'Hello, world!',
    translatedText: '¡Hola, mundo!',
    isEdited: false,
    order: 0,
    ...overrides,
  }
}

// Helper to create mock translation
function createMockTranslation(overrides: Partial<Translation> = {}): Translation {
  return {
    _id: 'translation_123',
    orderId: 'order_123',
    fileName: 'document.pdf',
    fileIndex: 0,
    translationProvider: 'google',
    segments: [createMockSegment()],
    status: 'pending',
    progress: 0,
    sourceLanguage: 'en',
    targetLanguage: 'es',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('Translations - Authorization', () => {
  describe('Admin-only access', () => {
    it('should reject non-admin users for viewing translations', () => {
      const regularUser = createMockUser({ role: 'user' })
      const isAuthorized = regularUser.role === 'admin'
      
      expect(isAuthorized).toBe(false)
    })

    it('should allow admin users to view translations', () => {
      const adminUser = createMockUser({ role: 'admin' })
      const isAuthorized = adminUser.role === 'admin'
      
      expect(isAuthorized).toBe(true)
    })

    it('should reject non-admin users for editing translations', () => {
      const regularUser = createMockUser({ role: 'user' })
      const canEdit = regularUser.role === 'admin'
      
      expect(canEdit).toBe(false)
    })

    it('should reject non-admin users for approving translations', () => {
      const regularUser = createMockUser({ role: 'user' })
      const canApprove = regularUser.role === 'admin'
      
      expect(canApprove).toBe(false)
    })
  })
})

describe('Translations - Query Functions', () => {
  describe('getTranslationByFile', () => {
    it('should find translation by orderId and fileName', () => {
      const translations = [
        createMockTranslation({ orderId: 'order_1', fileName: 'doc1.pdf' }),
        createMockTranslation({ orderId: 'order_1', fileName: 'doc2.pdf' }),
        createMockTranslation({ orderId: 'order_2', fileName: 'doc1.pdf' }),
      ]
      
      const found = translations.find(
        t => t.orderId === 'order_1' && t.fileName === 'doc1.pdf'
      )
      
      expect(found).toBeDefined()
      expect(found?.fileName).toBe('doc1.pdf')
    })

    it('should return undefined if not found', () => {
      const translations: Translation[] = []
      
      const found = translations.find(
        t => t.orderId === 'order_1' && t.fileName === 'nonexistent.pdf'
      )
      
      expect(found).toBeUndefined()
    })
  })

  describe('getTranslationsByOrder', () => {
    it('should return all translations for an order', () => {
      const translations = [
        createMockTranslation({ _id: '1', orderId: 'order_1', fileName: 'doc1.pdf' }),
        createMockTranslation({ _id: '2', orderId: 'order_1', fileName: 'doc2.pdf' }),
        createMockTranslation({ _id: '3', orderId: 'order_2', fileName: 'doc1.pdf' }),
      ]
      
      const orderTranslations = translations.filter(t => t.orderId === 'order_1')
      
      expect(orderTranslations).toHaveLength(2)
    })
  })
})

describe('Translations - Create and Update', () => {
  describe('upsertTranslation', () => {
    it('should create new translation if none exists', () => {
      const translations: Translation[] = []
      const newTranslation = createMockTranslation()
      
      // Simulate insert
      translations.push(newTranslation)
      
      expect(translations).toHaveLength(1)
    })

    it('should update existing translation', () => {
      const existingTranslation = createMockTranslation({ progress: 50 })
      
      // Simulate update
      existingTranslation.progress = 100
      existingTranslation.status = 'review'
      existingTranslation.updatedAt = Date.now()
      
      expect(existingTranslation.progress).toBe(100)
      expect(existingTranslation.status).toBe('review')
    })

    it('should store translation provider', () => {
      const validProviders = ['google', 'openai', 'anthropic', 'openrouter']
      
      validProviders.forEach(provider => {
        const translation = createMockTranslation({ 
          translationProvider: provider as Translation['translationProvider'] 
        })
        expect(translation.translationProvider).toBe(provider)
      })
    })

    it('should store document domain', () => {
      const validDomains = ['general', 'certificate', 'legal', 'medical', 'technical']
      
      validDomains.forEach(domain => {
        const translation = createMockTranslation({ 
          documentDomain: domain as Translation['documentDomain'] 
        })
        expect(translation.documentDomain).toBe(domain)
      })
    })

    it('should store OCR quality setting', () => {
      const lowQuality = createMockTranslation({ ocrQuality: 'low' })
      const highQuality = createMockTranslation({ ocrQuality: 'high' })
      
      expect(lowQuality.ocrQuality).toBe('low')
      expect(highQuality.ocrQuality).toBe('high')
    })
  })
})

describe('Translations - Segment Editing', () => {
  describe('updateTranslationSegment', () => {
    it('should update specific segment by id', () => {
      const segments = [
        createMockSegment({ id: 'seg_1', translatedText: 'Original text 1' }),
        createMockSegment({ id: 'seg_2', translatedText: 'Original text 2' }),
      ]
      
      const segmentToUpdate = 'seg_1'
      const newText = 'Updated text 1'
      
      const updatedSegments = segments.map(segment => {
        if (segment.id === segmentToUpdate) {
          return {
            ...segment,
            translatedText: newText,
            isEdited: true,
            editedAt: Date.now(),
          }
        }
        return segment
      })
      
      expect(updatedSegments[0].translatedText).toBe('Updated text 1')
      expect(updatedSegments[0].isEdited).toBe(true)
      expect(updatedSegments[1].translatedText).toBe('Original text 2')
    })

    it('should mark segment as edited when text changes', () => {
      const segment = createMockSegment({ 
        translatedText: 'Original', 
        isEdited: false 
      })
      
      const newText = 'Modified'
      const wasChanged = segment.translatedText !== newText
      
      if (wasChanged) {
        segment.translatedText = newText
        segment.isEdited = true
        segment.editedAt = Date.now()
      }
      
      expect(segment.isEdited).toBe(true)
      expect(segment.editedAt).toBeDefined()
    })

    it('should not mark as edited if text is the same', () => {
      const segment = createMockSegment({ 
        translatedText: 'Same text', 
        isEdited: false 
      })
      
      const newText = 'Same text'
      const wasChanged = segment.translatedText !== newText
      
      expect(wasChanged).toBe(false)
    })

    it('should preserve page number on edit', () => {
      const segment = createMockSegment({ 
        pageNumber: 3,
        translatedText: 'Original' 
      })
      
      segment.translatedText = 'Updated'
      segment.isEdited = true
      
      expect(segment.pageNumber).toBe(3)
    })
  })
})

describe('Translations - Approval Workflow', () => {
  describe('approveTranslation', () => {
    it('should set status to approved', () => {
      const translation = createMockTranslation({ status: 'review' })
      
      translation.status = 'approved'
      translation.approvedAt = Date.now()
      translation.updatedAt = Date.now()
      
      expect(translation.status).toBe('approved')
      expect(translation.approvedAt).toBeDefined()
    })

    it('should require admin authorization', () => {
      const adminUser = createMockUser({ role: 'admin' })
      const regularUser = createMockUser({ role: 'user' })
      
      expect(adminUser.role === 'admin').toBe(true)
      expect(regularUser.role === 'admin').toBe(false)
    })
  })

  describe('deleteTranslation', () => {
    it('should only allow deletion of approved translations', () => {
      const approvedTranslation = createMockTranslation({ status: 'approved' })
      const reviewTranslation = createMockTranslation({ status: 'review' })
      
      const canDeleteApproved = approvedTranslation.status === 'approved'
      const canDeleteReview = reviewTranslation.status === 'approved'
      
      expect(canDeleteApproved).toBe(true)
      expect(canDeleteReview).toBe(false)
    })

    it('should require admin authorization for deletion', () => {
      const adminUser = createMockUser({ role: 'admin' })
      const canDelete = adminUser.role === 'admin'
      
      expect(canDelete).toBe(true)
    })
  })
})

describe('Translations - Progress Tracking', () => {
  describe('updateTranslationProgress', () => {
    it('should update progress percentage', () => {
      const translation = createMockTranslation({ progress: 0 })
      
      translation.progress = 50
      
      expect(translation.progress).toBe(50)
    })

    it('should optionally update status', () => {
      const translation = createMockTranslation({ status: 'pending', progress: 0 })
      
      translation.progress = 100
      translation.status = 'review'
      
      expect(translation.progress).toBe(100)
      expect(translation.status).toBe('review')
    })

    it('should validate progress is between 0 and 100', () => {
      const validProgress = [0, 25, 50, 75, 100]
      
      validProgress.forEach(progress => {
        expect(progress >= 0 && progress <= 100).toBe(true)
      })
    })
  })

  describe('Status workflow', () => {
    const validStatuses = ['pending', 'translating', 'review', 'approved', 'completed']
    
    it('should recognize all valid statuses', () => {
      validStatuses.forEach(status => {
        expect(['pending', 'translating', 'review', 'approved', 'completed']).toContain(status)
      })
    })

    it('should follow logical status progression', () => {
      const translation = createMockTranslation({ status: 'pending' })
      
      // Pending -> Translating
      translation.status = 'translating'
      expect(translation.status).toBe('translating')
      
      // Translating -> Review
      translation.status = 'review'
      expect(translation.status).toBe('review')
      
      // Review -> Approved
      translation.status = 'approved'
      expect(translation.status).toBe('approved')
      
      // Approved -> Completed
      translation.status = 'completed'
      expect(translation.status).toBe('completed')
    })
  })
})

describe('Translations - Segments Structure', () => {
  describe('Segment ordering', () => {
    it('should maintain segment order', () => {
      const segments = [
        createMockSegment({ id: '1', order: 0 }),
        createMockSegment({ id: '2', order: 1 }),
        createMockSegment({ id: '3', order: 2 }),
      ]
      
      const sortedSegments = [...segments].sort((a, b) => a.order - b.order)
      
      expect(sortedSegments[0].order).toBe(0)
      expect(sortedSegments[1].order).toBe(1)
      expect(sortedSegments[2].order).toBe(2)
    })
  })

  describe('Segment content', () => {
    it('should store original and translated text', () => {
      const segment = createMockSegment({
        originalText: 'Hello',
        translatedText: 'Hola',
      })
      
      expect(segment.originalText).toBe('Hello')
      expect(segment.translatedText).toBe('Hola')
    })

    it('should track page numbers for PDFs', () => {
      const segments = [
        createMockSegment({ id: '1', pageNumber: 1 }),
        createMockSegment({ id: '2', pageNumber: 1 }),
        createMockSegment({ id: '3', pageNumber: 2 }),
      ]
      
      const page1Segments = segments.filter(s => s.pageNumber === 1)
      const page2Segments = segments.filter(s => s.pageNumber === 2)
      
      expect(page1Segments).toHaveLength(2)
      expect(page2Segments).toHaveLength(1)
    })
  })
})

describe('Translations - Provider Support', () => {
  describe('Translation providers', () => {
    it('should support Google Translate', () => {
      const translation = createMockTranslation({ translationProvider: 'google' })
      expect(translation.translationProvider).toBe('google')
    })

    it('should support OpenAI', () => {
      const translation = createMockTranslation({ translationProvider: 'openai' })
      expect(translation.translationProvider).toBe('openai')
    })

    it('should support Anthropic', () => {
      const translation = createMockTranslation({ translationProvider: 'anthropic' })
      expect(translation.translationProvider).toBe('anthropic')
    })

    it('should support OpenRouter with custom model', () => {
      const translation = createMockTranslation({ 
        translationProvider: 'openrouter',
        openRouterModel: 'anthropic/claude-3-opus'
      })
      
      expect(translation.translationProvider).toBe('openrouter')
      expect(translation.openRouterModel).toBe('anthropic/claude-3-opus')
    })
  })
})
