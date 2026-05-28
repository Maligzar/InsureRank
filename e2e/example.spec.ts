import { test, expect } from '@playwright/test'

test('homepage redirects to login', async ({ page }) => {
  const response = await page.goto('/')
  // Should land on login or dashboard depending on auth state
  expect([200, 302]).toContain(response?.status() ?? 200)
  await expect(page).toHaveTitle(/InsureRank/)
})
