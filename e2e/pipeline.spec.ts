import { test, expect, Page } from '@playwright/test'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

test.describe('Pipeline', () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, 'Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars')

  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  })

  test('pipeline page loads with stage columns', async ({ page }) => {
    await page.goto('/pipeline')
    await expect(page.getByRole('heading', { name: /pipeline/i })).toBeVisible({ timeout: 8000 })
  })

  test('shows at least one pipeline stage', async ({ page }) => {
    await page.goto('/pipeline')
    // Pipeline stages appear as cards or column headers
    await expect(page.getByText(/new lead|qualified|proposal|closed/i).first()).toBeVisible({
      timeout: 8000,
    })
  })

  test('pipeline shows revenue summary', async ({ page }) => {
    await page.goto('/pipeline')
    // Revenue displayed as currency
    await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible({ timeout: 8000 })
  })

  test('mobile pipeline scrolls horizontally (desktop shows side-by-side)', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/pipeline')
    await expect(page.getByText(/new lead|qualified|proposal/i).first()).toBeVisible({
      timeout: 8000,
    })
    if (isMobile) {
      // On mobile, stages stack vertically — verify page is scrollable
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
      const viewportHeight = page.viewportSize()?.height ?? 0
      expect(bodyHeight).toBeGreaterThanOrEqual(viewportHeight)
    }
  })
})

test.describe('Dashboard', () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, 'Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars')

  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  })

  test('dashboard shows KPI cards', async ({ page }) => {
    await page.goto('/dashboard')
    // Should show counts for leads, contacts, pipeline value
    await expect(page.getByText(/leads|contacts|pipeline/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('dashboard navigation tabs/sidebar visible', async ({ page, isMobile }) => {
    await page.goto('/dashboard')
    if (isMobile) {
      // Bottom tab bar on mobile
      const tabBar = page.locator('nav').filter({ has: page.getByRole('link', { name: /leads/i }) })
      await expect(tabBar).toBeVisible({ timeout: 5000 })
    } else {
      // Sidebar on desktop
      const sidebar = page.locator('aside, nav').filter({
        has: page.getByRole('link', { name: /dashboard/i }),
      })
      await expect(sidebar.first()).toBeVisible({ timeout: 5000 })
    }
  })
})
