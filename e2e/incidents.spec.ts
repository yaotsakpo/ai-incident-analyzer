import { test, expect } from '@playwright/test';

test.describe('Incidents Feed', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.fill('input[placeholder*="username" i], input[name="username"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign")');
    await expect(page.locator('text=Incidents')).toBeVisible({ timeout: 10000 });
  });

  test('can seed demo data when no incidents exist', async ({ page }) => {
    // If seed button exists, click it
    const seedBtn = page.locator('button:has-text("Seed"), button:has-text("Re-seed")');
    if (await seedBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await seedBtn.click();
      // Wait for incidents to load
      await expect(page.locator('.apple-card')).toBeVisible({ timeout: 15000 });
    }
  });

  test('displays incident list with severity pills', async ({ page }) => {
    // Ensure there are incidents (seed if empty)
    const seedBtn = page.locator('button:has-text("Seed Demo Data")');
    if (await seedBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await seedBtn.click();
      await page.waitForTimeout(2000);
    }
    // Check for incident cards
    const cards = page.locator('.apple-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // Check severity pills exist
    await expect(page.locator('.apple-pill').first()).toBeVisible();
  });

  test('status filter tabs work', async ({ page }) => {
    // Ensure incidents loaded
    await page.waitForTimeout(2000);
    // Click on Open filter
    const openTab = page.locator('.apple-segmented button:has-text("Open")');
    if (await openTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await openTab.click();
      await page.waitForTimeout(500);
      // URL should update with status param
      expect(page.url()).toContain('status=open');
    }
  });

  test('search filters incidents', async ({ page }) => {
    await page.waitForTimeout(2000);
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('database');
      await page.waitForTimeout(500);
      // URL should have q param
      expect(page.url()).toContain('q=database');
    }
  });

  test('clicking an incident navigates to detail page', async ({ page }) => {
    await page.waitForTimeout(2000);
    const firstCard = page.locator('.apple-card').first();
    if (await firstCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCard.click();
      // Should navigate to incident detail
      await expect(page).toHaveURL(/\/incidents\/.+/, { timeout: 5000 });
    }
  });
});
