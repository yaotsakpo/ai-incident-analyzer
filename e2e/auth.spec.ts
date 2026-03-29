import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows login page when not authenticated', async ({ page }) => {
    await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10000 });
  });

  test('login with valid credentials', async ({ page }) => {
    await page.fill('input[placeholder*="username" i], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign")');
    // Should navigate to the main app after login
    await expect(page.locator('text=Incidents')).toBeVisible({ timeout: 10000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.fill('input[placeholder*="username" i], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign")');
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 5000 });
  });

  test('logout returns to login page', async ({ page }) => {
    // Login first
    await page.fill('input[placeholder*="username" i], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign")');
    await expect(page.locator('text=Incidents')).toBeVisible({ timeout: 10000 });

    // Click logout
    await page.click('[title="Sign out"], button:has-text("Sign out"), button:has-text("Log out")');
    await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 5000 });
  });
});
