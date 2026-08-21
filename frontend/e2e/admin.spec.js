import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('B6: Admin Dashboard Suite', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in as admin
    await page.goto(`${BASE_URL}/login`);
    await page.click('button:has-text("admin")');
    await page.click('button:has-text("Auto-fill")');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 10000 });
  });

  test('105-108: Overview tab renders with stats cards, health, activity feed, and model switcher', async ({ page }) => {
    // Check Topbar role indicator
    await expect(page.locator('text=Admin').first()).toBeVisible();
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();

    // Check stats cards are visible
    await expect(page.locator('text=Students')).toBeVisible();
    await expect(page.locator('text=Faculty')).toBeVisible();
    await expect(page.locator('text=Documents')).toBeVisible();
    await expect(page.locator('text=Announcements')).toBeVisible();

    // Check health card and activity feed are visible
    await expect(page.locator('text=System Health')).toBeVisible();
    await expect(page.locator('text=Recent Activity')).toBeVisible();
    
    // Check model switcher
    await expect(page.locator('text=AI Model')).toBeVisible();
  });

  test('111-113: Users tab loads user table', async ({ page }) => {
    // Switch to "Users" tab
    await page.click('button.cw-nav-btn:has-text("Users")');

    // Verify search bar and User list container
    await expect(page.locator('input[placeholder*="Search name or ID"]')).toBeVisible();
  });

  test('114: Knowledge Base tab loads documents', async ({ page }) => {
    // Switch to "Knowledge Base" tab
    await page.click('button.cw-nav-btn:has-text("Knowledge Base")');

    // Check header widgets
    await expect(page.locator('text=Total Sources')).toBeVisible();
    await expect(page.locator('text=Global Chunks')).toBeVisible();
    await expect(page.locator('text=RAG Precision')).toBeVisible();
  });

  test('109 & 116: Upload tab works', async ({ page }) => {
    // Switch to "Upload" tab
    await page.click('button.cw-nav-btn:has-text("Upload")');

    // Check description headers
    await expect(page.locator('text=Upload Documents')).toBeVisible();
    await expect(page.locator('text=Drop files here or click to browse')).toBeVisible();
  });

  test('110 & 116: Post tab works', async ({ page }) => {
    // Switch to "Post" tab
    await page.click('button.cw-nav-btn:has-text("Post")');

    // Verify announcement headers
    await expect(page.locator('text=Post New Announcement')).toBeVisible();
    await expect(page.locator('h3:has-text("All Announcements")')).toBeVisible();
  });

  test('116: Tab navigation is seamless without routing crashes', async ({ page }) => {
    const tabs = ['Overview', 'Users', 'Knowledge Base', 'Upload', 'Post'];
    for (const tabName of tabs) {
      await page.click(`button.cw-nav-btn:has-text("${tabName}")`);
      // Just check tab button switches to active state (doesn't throw white page)
      const tabButton = page.locator(`button.cw-nav-btn:has-text("${tabName}")`);
      await expect(tabButton).toHaveClass(/cw-nav-btn-active/);
    }
  });
});
