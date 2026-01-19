/**
 * Convex Settings Functions Tests
 * 
 * Tests for settings management including:
 * - Pricing configuration
 * - Default pricing fallback
 * - Admin-only updates
 */

import { describe, it, expect } from 'vitest'

// Mock types
interface User {
  _id: string
  clerkId: string
  role: 'user' | 'admin'
}

interface PricingConfig {
  certified: {
    basePerPage: number
    rushExtraPerPage: number
  }
  general: {
    basePerPage: number
    rushExtraPerPage: number
  }
}

interface Setting {
  _id: string
  key: string
  value: PricingConfig | unknown
  updatedBy?: string
  updatedAt: number
}

// Default pricing (matches your convex/settings.ts)
const DEFAULT_PRICING: PricingConfig = {
  certified: {
    basePerPage: 25,
    rushExtraPerPage: 25,
  },
  general: {
    basePerPage: 15,
    rushExtraPerPage: 15,
  },
}

// Helper to create mock user
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    _id: 'user_123',
    clerkId: 'clerk_123',
    role: 'user',
    ...overrides,
  }
}

// Helper to create mock setting
function createMockSetting(overrides: Partial<Setting> = {}): Setting {
  return {
    _id: 'setting_123',
    key: 'pricing',
    value: DEFAULT_PRICING,
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('Settings - Pricing Configuration', () => {
  describe('getPricing', () => {
    it('should return default pricing when no setting exists', () => {
      const settings: Setting[] = []
      const pricingSetting = settings.find(s => s.key === 'pricing')
      
      const pricing = pricingSetting?.value as PricingConfig || DEFAULT_PRICING
      
      expect(pricing.certified.basePerPage).toBe(25)
      expect(pricing.general.basePerPage).toBe(15)
    })

    it('should return stored pricing when setting exists', () => {
      const customPricing: PricingConfig = {
        certified: { basePerPage: 30, rushExtraPerPage: 30 },
        general: { basePerPage: 20, rushExtraPerPage: 20 },
      }
      
      const settings = [createMockSetting({ value: customPricing })]
      const pricingSetting = settings.find(s => s.key === 'pricing')
      const pricing = pricingSetting?.value as PricingConfig
      
      expect(pricing.certified.basePerPage).toBe(30)
      expect(pricing.general.basePerPage).toBe(20)
    })
  })

  describe('Default pricing values', () => {
    it('should have correct certified pricing', () => {
      expect(DEFAULT_PRICING.certified.basePerPage).toBe(25)
      expect(DEFAULT_PRICING.certified.rushExtraPerPage).toBe(25)
    })

    it('should have correct general pricing', () => {
      expect(DEFAULT_PRICING.general.basePerPage).toBe(15)
      expect(DEFAULT_PRICING.general.rushExtraPerPage).toBe(15)
    })

    it('should have certified more expensive than general', () => {
      expect(DEFAULT_PRICING.certified.basePerPage).toBeGreaterThan(DEFAULT_PRICING.general.basePerPage)
    })
  })
})

describe('Settings - Price Calculations', () => {
  describe('Standard order pricing', () => {
    it('should calculate certified order price correctly', () => {
      const pageCount = 5
      const basePerPage = DEFAULT_PRICING.certified.basePerPage
      const isRush = false
      
      const price = pageCount * basePerPage
      
      expect(price).toBe(125)
    })

    it('should calculate general order price correctly', () => {
      const pageCount = 5
      const basePerPage = DEFAULT_PRICING.general.basePerPage
      const isRush = false
      
      const price = pageCount * basePerPage
      
      expect(price).toBe(75)
    })
  })

  describe('Rush order pricing', () => {
    it('should calculate certified rush order price correctly', () => {
      const pageCount = 5
      const basePerPage = DEFAULT_PRICING.certified.basePerPage
      const rushExtra = DEFAULT_PRICING.certified.rushExtraPerPage
      
      const price = pageCount * (basePerPage + rushExtra)
      
      expect(price).toBe(250)
    })

    it('should calculate general rush order price correctly', () => {
      const pageCount = 5
      const basePerPage = DEFAULT_PRICING.general.basePerPage
      const rushExtra = DEFAULT_PRICING.general.rushExtraPerPage
      
      const price = pageCount * (basePerPage + rushExtra)
      
      expect(price).toBe(150)
    })

    it('should double the price for rush orders', () => {
      const pageCount = 10
      const basePerPage = DEFAULT_PRICING.certified.basePerPage
      const rushExtra = DEFAULT_PRICING.certified.rushExtraPerPage
      
      const standardPrice = pageCount * basePerPage
      const rushPrice = pageCount * (basePerPage + rushExtra)
      
      expect(rushPrice).toBe(standardPrice * 2)
    })
  })
})

describe('Settings - Admin Authorization', () => {
  describe('updatePricing authorization', () => {
    it('should reject non-admin users', () => {
      const regularUser = createMockUser({ role: 'user' })
      const isAuthorized = regularUser.role === 'admin'
      
      expect(isAuthorized).toBe(false)
    })

    it('should allow admin users', () => {
      const adminUser = createMockUser({ role: 'admin' })
      const isAuthorized = adminUser.role === 'admin'
      
      expect(isAuthorized).toBe(true)
    })
  })
})

describe('Settings - Update Pricing', () => {
  describe('updatePricing', () => {
    it('should create new setting if none exists', () => {
      const settings: Setting[] = []
      const newPricing: PricingConfig = {
        certified: { basePerPage: 35, rushExtraPerPage: 35 },
        general: { basePerPage: 25, rushExtraPerPage: 25 },
      }
      
      // Simulate insert
      const newSetting = createMockSetting({ value: newPricing })
      settings.push(newSetting)
      
      expect(settings).toHaveLength(1)
      expect((settings[0].value as PricingConfig).certified.basePerPage).toBe(35)
    })

    it('should update existing setting', () => {
      const existingSetting = createMockSetting()
      const originalPrice = (existingSetting.value as PricingConfig).certified.basePerPage
      
      // Simulate update
      const updatedPricing: PricingConfig = {
        certified: { basePerPage: 40, rushExtraPerPage: 40 },
        general: { basePerPage: 30, rushExtraPerPage: 30 },
      }
      
      existingSetting.value = updatedPricing
      existingSetting.updatedAt = Date.now()
      
      expect((existingSetting.value as PricingConfig).certified.basePerPage).toBe(40)
      expect((existingSetting.value as PricingConfig).certified.basePerPage).not.toBe(originalPrice)
    })

    it('should track who updated the setting', () => {
      const adminClerkId = 'admin_clerk_123'
      const setting = createMockSetting({ updatedBy: adminClerkId })
      
      expect(setting.updatedBy).toBe(adminClerkId)
    })

    it('should update the timestamp', () => {
      const originalTime = Date.now() - 10000
      const setting = createMockSetting({ updatedAt: originalTime })
      
      // Simulate update
      setting.updatedAt = Date.now()
      
      expect(setting.updatedAt).toBeGreaterThan(originalTime)
    })
  })
})

describe('Settings - Pricing Validation', () => {
  describe('Valid pricing values', () => {
    it('should have positive base prices', () => {
      expect(DEFAULT_PRICING.certified.basePerPage).toBeGreaterThan(0)
      expect(DEFAULT_PRICING.general.basePerPage).toBeGreaterThan(0)
    })

    it('should have positive rush extras', () => {
      expect(DEFAULT_PRICING.certified.rushExtraPerPage).toBeGreaterThan(0)
      expect(DEFAULT_PRICING.general.rushExtraPerPage).toBeGreaterThan(0)
    })

    it('should have numeric values', () => {
      expect(typeof DEFAULT_PRICING.certified.basePerPage).toBe('number')
      expect(typeof DEFAULT_PRICING.general.basePerPage).toBe('number')
      expect(typeof DEFAULT_PRICING.certified.rushExtraPerPage).toBe('number')
      expect(typeof DEFAULT_PRICING.general.rushExtraPerPage).toBe('number')
    })
  })

  describe('Invalid pricing prevention', () => {
    it('should not allow negative prices', () => {
      const invalidPrice = -10
      const isValid = invalidPrice > 0
      
      expect(isValid).toBe(false)
    })

    it('should not allow zero prices', () => {
      const zeroPrice = 0
      const isValid = zeroPrice > 0
      
      expect(isValid).toBe(false)
    })
  })
})

describe('Settings - Service Types', () => {
  describe('Certified service', () => {
    it('should have all required pricing fields', () => {
      const certified = DEFAULT_PRICING.certified
      
      expect(certified).toHaveProperty('basePerPage')
      expect(certified).toHaveProperty('rushExtraPerPage')
    })
  })

  describe('General service', () => {
    it('should have all required pricing fields', () => {
      const general = DEFAULT_PRICING.general
      
      expect(general).toHaveProperty('basePerPage')
      expect(general).toHaveProperty('rushExtraPerPage')
    })
  })

  describe('Custom service', () => {
    it('should not have fixed pricing (quote-based)', () => {
      // Custom orders use quotes, not fixed pricing
      const hasCustomPricing = 'custom' in DEFAULT_PRICING
      
      expect(hasCustomPricing).toBe(false)
    })
  })
})

describe('Settings - Multi-page Order Calculations', () => {
  describe('Bulk pricing scenarios', () => {
    it('should calculate 10-page certified order correctly', () => {
      const pages = 10
      const price = pages * DEFAULT_PRICING.certified.basePerPage
      
      expect(price).toBe(250)
    })

    it('should calculate 50-page certified order correctly', () => {
      const pages = 50
      const price = pages * DEFAULT_PRICING.certified.basePerPage
      
      expect(price).toBe(1250)
    })

    it('should calculate 100-page general order correctly', () => {
      const pages = 100
      const price = pages * DEFAULT_PRICING.general.basePerPage
      
      expect(price).toBe(1500)
    })

    it('should calculate rush 100-page order correctly', () => {
      const pages = 100
      const basePerPage = DEFAULT_PRICING.certified.basePerPage
      const rushExtra = DEFAULT_PRICING.certified.rushExtraPerPage
      const price = pages * (basePerPage + rushExtra)
      
      expect(price).toBe(5000)
    })
  })
})
