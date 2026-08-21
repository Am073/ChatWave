import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('B1: Auth Pages', () => {
  test('69: Login page renders inputs and role selectors', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check main title
    await expect(page.locator('h1')).toHaveText('ChatWave');
    
    // Check role selector buttons
    await expect(page.locator('button:has-text("student")')).toBeVisible();
    await expect(page.locator('button:has-text("faculty")')).toBeVisible();
    await expect(page.locator('button:has-text("admin")')).toBeVisible();
    
    // Check inputs
    await expect(page.locator('input[placeholder="Enter your college ID"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    
    // Check sign in button
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in to ChatWave');
  });

  test('70: Register page renders register inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    
    // Check main title
    await expect(page.locator('h1')).toHaveText('Create Account');
    
    // Check inputs
    await expect(page.locator('input[placeholder="John Doe"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. CS2021045"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Min 8 characters"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Your college name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Computer Science"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('71: Full register flow redirecting to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    
    const uniqueId = `STU_${Math.floor(Math.random() * 1000000)}`;
    
    await page.fill('input[placeholder="John Doe"]', 'Alice Test Student');
    await page.fill('input[placeholder="e.g. CS2021045"]', uniqueId);
    await page.fill('input[placeholder="Min 8 characters"]', 'StrongP@ss123');
    await page.fill('input[placeholder="Your college name"]', 'ChatWave College');
    await page.fill('input[placeholder="e.g. Computer Science"]', 'CS');
    await page.selectOption('select', 'student');
    
    await page.click('button[type="submit"]');
    
    // Verify success banner and redirect
    await expect(page.locator('text=Account created!')).toBeVisible();
    await page.waitForURL('**/login', { timeout: 5000 });
  });

  test('72: Login flow redirecting to student dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Click student role button (active by default, but click to be sure)
    await page.click('button:has-text("student")');
    
    // Auto-fill or manually enter demo student credentials
    await page.click('button:has-text("Auto-fill")');
    
    await page.click('button[type="submit"]');
    
    // Verify dashboard navigation
    await page.waitForURL('**/student', { timeout: 10000 });
    await expect(page.locator('text=ChatWave AI')).toBeVisible();
  });

  test('73: Login error with bad credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[placeholder="Enter your college ID"]', 'STU_WRONG_ID');
    await page.fill('input[placeholder="••••••••"]', 'WrongPassword123');
    
    await page.click('button[type="submit"]');
    
    // Verify error message is visible
    await expect(page.locator('.text-red-400')).toBeVisible({ timeout: 5000 });
  });

  test('74: Auth redirect when not logged in', async ({ page }) => {
    // Navigate straight to student dashboard without login
    await page.goto(`${BASE_URL}/student`);
    
    // Should auto-redirect to login
    await page.waitForURL('**/login', { timeout: 5000 });
  });

  test('75: Role guard redirecting back to home/role page', async ({ page }) => {
    // 1. Login as student first
    await page.goto(`${BASE_URL}/login`);
    await page.click('button:has-text("student")');
    await page.click('button:has-text("Auto-fill")');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student', { timeout: 10000 });
    
    // 2. Try to access admin dashboard
    await page.goto(`${BASE_URL}/admin`);
    
    // 3. Should guard and redirect back to student dashboard (or root/login)
    await page.waitForURL('**/student', { timeout: 5000 });
  });
});
