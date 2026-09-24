import { test, expect } from '@playwright/test';

test('home page loads cleanly without server errors', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (err) => pageErrors.push(err));

  const response = await page.goto('http://localhost:4321/');
  expect(response?.status()).toBe(200);

  // Check headline text
  await expect(page.getByText('Augury').first()).toBeVisible();
  expect(pageErrors.length).toBe(0);
});

test('admin page loads cleanly', async ({ page }) => {
  const response = await page.goto('http://localhost:4321/admin');
  expect(response?.status()).toBe(200);
});

test('styleguide page loads cleanly', async ({ page }) => {
  const response = await page.goto('http://localhost:4321/styleguide');
  expect(response?.status()).toBe(200);
});
