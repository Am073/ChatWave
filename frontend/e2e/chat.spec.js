import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('B2-B4: Student Dashboard & Settings', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Log in as student
    await page.goto(`${BASE_URL}/login`);
    await page.click('button:has-text("student")');
    await page.click('button:has-text("Auto-fill")');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student', { timeout: 10000 });
  });

  test('76: Chat tab active by default', async ({ page }) => {
    await expect(page.locator('text=ChatWave AI')).toBeVisible();
    await expect(page.locator('id=nav-tab-chat')).toHaveClass(/cw-nav-btn-active/);
  });

  test('77: Empty state shows suggestions and greeting', async ({ page }) => {
    await expect(page.locator('text=How can I help you today?')).toBeVisible();
    await expect(page.locator('text=When is my next exam?')).toBeVisible();
    await expect(page.locator('text=What is the fee deadline?')).toBeVisible();
  });

  test('78: College mode is default', async ({ page }) => {
    // Check mode text
    await expect(page.locator('text=Online · Answers from your college only')).toBeVisible();
    
    // Check "🎓 College" button has the active class/style
    const collegeBtn = page.locator('button:has-text("College")');
    await expect(collegeBtn).toHaveClass(/bg-cw-blue/);
  });

  test('79: Switch to General mode', async ({ page }) => {
    // Click "General" mode toggle
    await page.click('button:has-text("General")');
    
    // Check mode text updates
    await expect(page.locator('text=Online · General AI mode')).toBeVisible();
    
    const generalBtn = page.locator('button:has-text("General")');
    await expect(generalBtn).toHaveClass(/bg-emerald-500/);
  });

  test('80-81: Send message in General mode', async ({ page }) => {
    await page.click('button:has-text("General")');
    
    // Fill chat input
    const chatInput = page.locator('input[placeholder="Ask anything about your college..."]');
    await chatInput.fill('What is 2+2?');
    await chatInput.press('Enter');
    
    // Verify user message appears in list
    await expect(page.locator('text=What is 2+2?')).toBeVisible();
  });

  test('85: Clear chat history', async ({ page }) => {
    // Send a message first
    const chatInput = page.locator('input[placeholder="Ask anything about your college..."]');
    await chatInput.fill('Temporary Message');
    await chatInput.press('Enter');
    await expect(page.locator('text=Temporary Message')).toBeVisible();
    
    // Click clear
    await page.click('button:has-text("Clear")');
    
    // Verify we go back to greeting/empty state and message is gone
    await expect(page.locator('text=How can I help you today?')).toBeVisible();
    await expect(page.locator('text=Temporary Message')).not.toBeVisible();
  });

  test('90-91: Switch to announcements tab', async ({ page }) => {
    // Click announcements in navigation bar
    await page.click('id=nav-tab-announcements');
    
    // Verify announcements page content
    await expect(page.locator('id=nav-tab-announcements')).toHaveClass(/cw-nav-btn-active/);
    
    // Should show section header or empty state
    await expect(page.locator('text=Live Feed').first()).toBeVisible();
  });

  test('94-96: Settings modal and calendar section', async ({ page }) => {
    // Click gear settings icon
    await page.click('id=settings-btn');
    
    // Check modal displays "Settings"
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
    
    // Verify Profile section is rendered with student role
    await expect(page.locator('text=Role')).toBeVisible();
    await expect(page.locator('text=student').last()).toBeVisible();
    
    // Verify Google Calendar section is rendered
    await expect(page.locator('h4:has-text("Google Calendar")')).toBeVisible();
    await expect(page.locator('button:has-text("Calendar")').or(page.locator('button:has-text("Sync")'))).toBeVisible();
  });
});
