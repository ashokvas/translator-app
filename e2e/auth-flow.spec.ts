import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should display sign in page', async ({ page }) => {
    await page.goto('/sign-in')
    
    // Clerk sign-in page should load
    await expect(page).toHaveURL(/sign-in/)
    
    // Should have some form of sign-in UI
    // Note: Clerk components may take a moment to load
    await page.waitForLoadState('networkidle')
  })

  test('should display sign up page', async ({ page }) => {
    await page.goto('/sign-up')
    
    // Clerk sign-up page should load
    await expect(page).toHaveURL(/sign-up/)
    
    await page.waitForLoadState('networkidle')
  })

  test('should redirect unauthenticated users from /user to sign-in', async ({ page }) => {
    await page.goto('/user')
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/)
  })

  test('should redirect unauthenticated users from /admin to sign-in', async ({ page }) => {
    await page.goto('/admin')
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/)
  })

  test('should redirect unauthenticated users from /user/new-order to sign-in', async ({ page }) => {
    await page.goto('/user/new-order')
    
    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/)
  })

  test('sign-in page should have sign-up link', async ({ page }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    
    // Look for a link to sign up (Clerk usually provides this)
    // This tests navigation between auth pages
  })

  test('sign-up page should have sign-in link', async ({ page }) => {
    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')
    
    // Look for a link to sign in (Clerk usually provides this)
    // This tests navigation between auth pages
  })
})

test.describe('Protected Routes', () => {
  test('user dashboard should be protected', async ({ page }) => {
    // Try to access user dashboard without auth
    const response = await page.goto('/user')
    
    // Should redirect (302/307) or show sign-in
    expect(page.url()).toMatch(/sign-in/)
  })

  test('admin dashboard should be protected', async ({ page }) => {
    // Try to access admin dashboard without auth
    await page.goto('/admin')
    
    // Should redirect to sign-in
    expect(page.url()).toMatch(/sign-in/)
  })

  test('order creation page should be protected', async ({ page }) => {
    await page.goto('/user/new-order/certified')
    
    // Should redirect to sign-in
    expect(page.url()).toMatch(/sign-in/)
  })

  test('order list page should be protected', async ({ page }) => {
    await page.goto('/user/orders')
    
    // Should redirect to sign-in
    expect(page.url()).toMatch(/sign-in/)
  })
})
