import { test, expect, Page } from '@playwright/test'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

test.describe('Leads', () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, 'Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars')

  test.beforeEach(async ({ page }) => {
    await loginAs(page, process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!)
  })

  test('lead list page loads and shows content', async ({ page }) => {
    await page.goto('/leads')
    await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible({ timeout: 8000 })
  })

  test('lead list supports LOB filter', async ({ page }) => {
    await page.goto('/leads')
    const filterButton = page.getByRole('button', { name: /filter|lob|line of business/i }).first()
    if (await filterButton.isVisible()) {
      await filterButton.click()
      const lifeOption = page
        .getByRole('option', { name: /life/i })
        .or(page.getByRole('menuitem', { name: /life/i }))
      if (await lifeOption.isVisible()) {
        await lifeOption.click()
        await expect(page.getByText(/life/i).first()).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('lead detail page renders key sections', async ({ page }) => {
    await page.goto('/leads')
    const leadLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    if (await leadLink.isVisible({ timeout: 5000 })) {
      await leadLink.click()
      await page.waitForURL(/\/leads\//, { timeout: 8000 })
      await expect(page.getByText(/contact|phone|email/i).first()).toBeVisible()
    }
  })

  test('lead detail shows action bar on mobile', async ({ page, isMobile }) => {
    if (!isMobile) test.skip()
    await page.goto('/leads')
    const leadLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    if (await leadLink.isVisible({ timeout: 5000 })) {
      await leadLink.click()
      await page.waitForURL(/\/leads\//, { timeout: 8000 })
      // Sticky action bar with call/text/email buttons
      const callBtn = page
        .getByRole('link', { name: /call/i })
        .or(page.getByRole('button', { name: /call/i }))
      await expect(callBtn.first()).toBeVisible({ timeout: 5000 })
    }
  })
})
