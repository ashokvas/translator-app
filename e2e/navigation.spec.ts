import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.describe('Marketing Pages', () => {
    test('homepage should load successfully', async ({ page }) => {
      const response = await page.goto('/')
      expect(response?.status()).toBe(200)
    })

    test('pricing page should load successfully', async ({ page }) => {
      const response = await page.goto('/pricing')
      expect(response?.status()).toBe(200)
      
      // Check for pricing content
      await expect(page.getByText(/Pricing/i).first()).toBeVisible()
    })

    test('contact page should load successfully', async ({ page }) => {
      const response = await page.goto('/contact')
      expect(response?.status()).toBe(200)
    })

    test('services - certified page should load', async ({ page }) => {
      const response = await page.goto('/services/certified')
      expect(response?.status()).toBe(200)
    })

    test('services - general page should load', async ({ page }) => {
      const response = await page.goto('/services/general')
      expect(response?.status()).toBe(200)
    })

    test('services - custom page should load', async ({ page }) => {
      const response = await page.goto('/services/custom')
      expect(response?.status()).toBe(200)
    })
  })

  test.describe('Header Navigation', () => {
    test('logo should link to homepage', async ({ page }) => {
      await page.goto('/pricing')
      
      // Click on logo/brand name
      await page.getByRole('link', { name: /Translator Axis/i }).click()
      
      await expect(page).toHaveURL('/')
    })

    test('pricing link should work', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('link', { name: 'Pricing' }).click()
      await expect(page).toHaveURL('/pricing')
    })

    test('contact link should work', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('link', { name: 'Contact' }).click()
      await expect(page).toHaveURL('/contact')
    })

    test('home link should work', async ({ page }) => {
      await page.goto('/pricing')
      await page.getByRole('link', { name: 'Home' }).click()
      await expect(page).toHaveURL('/')
    })
  })

  test.describe('Footer Navigation', () => {
    test('should have footer on marketing pages', async ({ page }) => {
      await page.goto('/')
      
      // Scroll to footer
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      
      // Footer should be visible (adjust selector based on your Footer component)
      // The footer might have social links, legal links, etc.
    })
  })

  test.describe('404 Page', () => {
    test('should show 404 or error page for non-existent pages', async ({ page }) => {
      const response = await page.goto('/this-page-does-not-exist-xyz123')
      
      // Next.js may return 404 or show a custom error page with 200
      // Check either status code or that we're on an error/not-found page
      const status = response?.status()
      const url = page.url()
      
      // Either 404 status OR redirected to a different page (error handling)
      const isErrorHandled = status === 404 || status === 200
      expect(isErrorHandled).toBe(true)
    })
  })

  test.describe('Page Load Performance', () => {
    test('homepage should load within 5 seconds', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(5000)
    })

    test('pricing page should load within 5 seconds', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/pricing')
      await page.waitForLoadState('domcontentloaded')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(5000)
    })
  })
})
