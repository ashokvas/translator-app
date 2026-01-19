import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display the main heading', async ({ page }) => {
    // Check for the hero heading
    const heading = page.getByRole('heading', { 
      name: /Professional Translation Services/i 
    })
    await expect(heading).toBeVisible()
  })

  test('should display the header navigation', async ({ page }) => {
    // Check navigation links exist
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Services' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible()
  })

  test('should display sign in and sign up buttons', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Sign In/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Sign Up/i })).toBeVisible()
  })

  test('should navigate to pricing page', async ({ page }) => {
    await page.getByRole('link', { name: 'Pricing' }).click()
    await expect(page).toHaveURL('/pricing')
  })

  test('should navigate to services page', async ({ page }) => {
    await page.getByRole('link', { name: 'Services' }).click()
    await expect(page).toHaveURL(/\/services/)
  })

  test('should navigate to contact page', async ({ page }) => {
    await page.getByRole('link', { name: 'Contact' }).click()
    await expect(page).toHaveURL('/contact')
  })

  test('Get Started button should redirect to sign up', async ({ page }) => {
    // Click the Get Started button in hero section
    const getStartedButton = page.getByRole('link', { name: /Get Started/i }).first()
    await getStartedButton.click()
    await expect(page).toHaveURL(/sign-up/)
  })

  test('View Pricing button should work', async ({ page }) => {
    const viewPricingButton = page.getByRole('link', { name: /View Pricing/i }).first()
    await viewPricingButton.click()
    await expect(page).toHaveURL('/pricing')
  })

  test('should display trust badges', async ({ page }) => {
    // Check for trust badges/compliance strip
    await expect(page.getByText(/USCIS accepted/i)).toBeVisible()
    await expect(page.getByText(/Encrypted files/i)).toBeVisible()
  })

  test('should display how it works section', async ({ page }) => {
    await expect(page.getByText(/How it works/i)).toBeVisible()
    await expect(page.getByText(/Upload/i)).toBeVisible()
    await expect(page.getByText(/Quote/i)).toBeVisible()
    await expect(page.getByText(/Translate/i)).toBeVisible()
    await expect(page.getByText(/Deliver/i)).toBeVisible()
  })

  test('should display FAQ section', async ({ page }) => {
    await expect(page.getByText(/FAQ/i)).toBeVisible()
    
    // Check FAQ accordion
    const faqQuestion = page.getByText(/certified translations USCIS accepted/i)
    await expect(faqQuestion).toBeVisible()
  })

  test('should display statistics', async ({ page }) => {
    await expect(page.getByText(/100\+/)).toBeVisible()
    await expect(page.getByText(/Languages Supported/i)).toBeVisible()
  })

  test('should display testimonials section', async ({ page }) => {
    await expect(page.getByText(/Testimonials/i)).toBeVisible()
    await expect(page.getByText(/What Our Customers Say/i)).toBeVisible()
  })

  test('should display CTA section at bottom', async ({ page }) => {
    // Scroll to bottom to see CTA
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    
    await expect(page.getByText(/Ready to Get Started/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Create Free Account/i })).toBeVisible()
  })

  test('page should not have any console errors', async ({ page }) => {
    const errors: string[] = []
    
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Filter out known non-critical errors (like hydration warnings in dev)
    const criticalErrors = errors.filter(
      (err) => !err.includes('hydrat') && !err.includes('Hydrat')
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('should be responsive - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
    await page.goto('/')

    // Check that mobile menu button is visible
    // (hamburger menu should appear on mobile)
    const mobileMenuButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(mobileMenuButton).toBeVisible()
  })
})
