import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('requesting a magic link submits successfully without 415 or server error', async ({ page }) => {
    await page.goto('http://localhost:4321/');

    const emailInput = page.getByPlaceholder('keeper@example.com');
    await expect(emailInput).toBeVisible();

    await emailInput.fill('testkeeper@example.com');

    const submitBtn = page.getByRole('button', { name: 'Sign In' });
    await expect(submitBtn).toBeVisible();

    await submitBtn.click();

    // Check success feedback message in UI
    await expect(page.getByText(/Check your ledger inbox for the magic link/i)).toBeVisible({ timeout: 10000 });
  });
});
