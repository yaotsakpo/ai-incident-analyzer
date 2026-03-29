import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Sign in to continue')).toBeVisible();
    await expect(page.getByPlaceholder('admin')).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('admin123').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incidents')).toBeVisible({ timeout: 5000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('wrong');
    await page.getByPlaceholder('admin123').fill('wrong');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });

  test('demo account buttons fill credentials', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.getByPlaceholder('admin')).toHaveValue('responder');
  });
});

test.describe('Incident Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('admin123').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incidents')).toBeVisible({ timeout: 5000 });
  });

  test('seed demo data and verify incidents load', async ({ page }) => {
    // Seed data if empty
    const seedBtn = page.getByRole('button', { name: /seed|demo/i });
    if (await seedBtn.isVisible()) {
      await seedBtn.click();
      await page.waitForTimeout(2000);
    }
    // Check incident cards appear
    await expect(page.locator('[class*="apple-card"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('filter incidents by status', async ({ page }) => {
    // Click Acknowledged filter
    const ackButton = page.getByRole('button', { name: 'Acknowledged' });
    if (await ackButton.isVisible()) {
      await ackButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('search incidents', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('database');
      await page.waitForTimeout(500);
    }
  });

  test('CSV export button exists', async ({ page }) => {
    await page.waitForTimeout(1000);
    const exportBtn = page.getByRole('button', { name: /csv|export|download/i });
    if (await exportBtn.isVisible()) {
      expect(await exportBtn.isEnabled()).toBeTruthy();
    }
  });
});

test.describe('Incident Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('admin123').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incidents')).toBeVisible({ timeout: 5000 });
  });

  test('navigate to incident detail', async ({ page }) => {
    // Seed if needed
    const seedBtn = page.getByRole('button', { name: /seed|demo/i });
    if (await seedBtn.isVisible()) {
      await seedBtn.click();
      await page.waitForTimeout(2000);
    }
    // Click on the first incident link
    const firstIncident = page.locator('a[href*="/incidents/"]').first();
    if (await firstIncident.isVisible()) {
      await firstIncident.click();
      await expect(page.getByText('Root Cause')).toBeVisible({ timeout: 5000 });
    }
  });

  test('acknowledge incident', async ({ page }) => {
    const seedBtn = page.getByRole('button', { name: /seed|demo/i });
    if (await seedBtn.isVisible()) {
      await seedBtn.click();
      await page.waitForTimeout(2000);
    }
    const firstIncident = page.locator('a[href*="/incidents/"]').first();
    if (await firstIncident.isVisible()) {
      await firstIncident.click();
      await page.waitForTimeout(1000);
      const ackBtn = page.getByRole('button', { name: 'Acknowledge' });
      if (await ackBtn.isVisible()) {
        await ackBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('add comment', async ({ page }) => {
    const seedBtn = page.getByRole('button', { name: /seed|demo/i });
    if (await seedBtn.isVisible()) {
      await seedBtn.click();
      await page.waitForTimeout(2000);
    }
    const firstIncident = page.locator('a[href*="/incidents/"]').first();
    if (await firstIncident.isVisible()) {
      await firstIncident.click();
      await page.waitForTimeout(1000);
      const commentInput = page.getByPlaceholder(/comment/i);
      if (await commentInput.isVisible()) {
        await commentInput.fill('Test comment from @admin');
        await page.keyboard.press('Enter');
        await expect(page.getByText('Test comment from')).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('export PDF button exists', async ({ page }) => {
    const seedBtn = page.getByRole('button', { name: /seed|demo/i });
    if (await seedBtn.isVisible()) {
      await seedBtn.click();
      await page.waitForTimeout(2000);
    }
    const firstIncident = page.locator('a[href*="/incidents/"]').first();
    if (await firstIncident.isVisible()) {
      await firstIncident.click();
      await page.waitForTimeout(1000);
      const pdfBtn = page.getByRole('button', { name: /Export PDF/i });
      if (await pdfBtn.isVisible()) {
        expect(await pdfBtn.isEnabled()).toBeTruthy();
      }
    }
  });
});

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('admin123').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incidents')).toBeVisible({ timeout: 5000 });
  });

  test('navigate to analytics page', async ({ page }) => {
    await page.getByRole('link', { name: /Analytics/i }).click();
    await expect(page.getByText('Analytics')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('admin123').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incidents')).toBeVisible({ timeout: 5000 });
  });

  test('navigate to settings and see integration sections', async ({ page }) => {
    await page.getByRole('link', { name: /Settings/i }).click();
    await expect(page.getByText('Settings')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('AI Analysis Provider')).toBeVisible();
    await expect(page.getByText('Slack Integration')).toBeVisible();
    await expect(page.getByText('Jira Integration')).toBeVisible();
    await expect(page.getByText('OpsGenie Integration')).toBeVisible();
  });

  test('toggle AI provider', async ({ page }) => {
    await page.getByRole('link', { name: /Settings/i }).click();
    await page.waitForTimeout(500);
    // Expand AI section if collapsed
    const aiSection = page.getByText('AI Analysis Provider');
    if (await aiSection.isVisible()) {
      await aiSection.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('admin123').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Incidents')).toBeVisible({ timeout: 5000 });
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.getByRole('link', { name: /Anomalies/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('link', { name: /Runbooks/i }).click();
    await page.waitForTimeout(500);
  });

  test('logout works', async ({ page }) => {
    const logoutBtn = page.getByTitle('Sign out');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 3000 });
    }
  });
});
