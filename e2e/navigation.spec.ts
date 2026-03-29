import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.fill('input[placeholder*="username" i], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign")');
    await expect(page.locator('text=Incidents')).toBeVisible({ timeout: 10000 });
  });

  test('sidebar navigation links work', async ({ page }) => {
    // Navigate to Settings
    await page.click('a[href="/settings"], nav >> text=Settings');
    await expect(page.locator('text=Settings')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/settings/);

    // Navigate to Analytics
    await page.click('a[href="/analytics"], nav >> text=Analytics');
    await expect(page).toHaveURL(/\/analytics/);

    // Navigate back to Incidents
    await page.click('a[href="/"], nav >> text=Incidents');
    await expect(page).toHaveURL(/\/$/);
  });

  test('settings page loads profile section', async ({ page }) => {
    await page.click('a[href="/settings"], nav >> text=Settings');
    await expect(page.locator('text=Signed in as')).toBeVisible({ timeout: 5000 });
  });

  test('runbooks page is accessible', async ({ page }) => {
    await page.click('a[href="/runbooks"], nav >> text=Runbooks');
    await expect(page).toHaveURL(/\/runbooks/);
    await expect(page.locator('text=Runbooks')).toBeVisible({ timeout: 5000 });
  });
});
