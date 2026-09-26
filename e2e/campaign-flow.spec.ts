import { test, expect } from "@playwright/test";
import { seedTestData } from "./seed.js";

test.beforeAll(async () => {
  await seedTestData();
});

test("canonical redirect for bare slug parameter", async ({ page }) => {
  const res = await page.goto("http://localhost:4321/g/e2etst");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/g\/e2e-campaign-group-e2etst/);
});

test("public group page renders open sessions and roster", async ({ page }) => {
  const res = await page.goto("http://localhost:4321/g/e2e-campaign-group-e2etst");
  expect(res?.status()).toBe(200);

  // Check Title
  expect(await page.title()).toContain("E2E Campaign Group");

  // Check main heading text
  await expect(page.getByRole("heading", { name: "E2E Campaign Group" })).toBeVisible();

  // Roster players
  await expect(page.getByText("Gimli Son of Gloin")).toBeVisible();
  await expect(page.getByText("Legolas Greenleaf")).toBeVisible();
});

test("voting flow: pick player, select days, submit votes, verify live tally update", async ({ page }) => {
  const res = await page.goto("http://localhost:4321/g/e2e-campaign-group-e2etst/e2esess100");
  expect(res?.status()).toBe(200);

  // Check heading
  await expect(page.getByRole("heading", { name: /Week of 28 Sep/i })).toBeVisible();

  // Step 1: Select Player "Gimli Son of Gloin"
  const playerBtn = page.getByText("Gimli Son of Gloin").first();
  await expect(playerBtn).toBeVisible();
  await playerBtn.click();

  // Step 2: Toggle candidate day (Mon)
  const monBtn = page.getByRole("button", { name: /Mon/i });
  await expect(monBtn).toBeVisible();
  await monBtn.click();

  // Step 3: Click Submit Votes
  const submitBtn = page.getByRole("button", { name: /Submit Votes/i });
  await expect(submitBtn).toBeVisible();
  await submitBtn.click();

  // Verify feedback message
  const successMessage = page.getByText(/submitted successfully|Response submitted/i);
  await expect(successMessage).toBeVisible({ timeout: 10000 });

  // Step 4: Submit a second vote as Legolas to reach viability threshold
  await page.goto("http://localhost:4321/g/e2e-campaign-group-e2etst/e2esess100");
  const player2Btn = page.getByText("Legolas Greenleaf").first();
  await expect(player2Btn).toBeVisible();
  await player2Btn.click();
  const monBtn2 = page.getByRole("button", { name: /Mon/i });
  await expect(monBtn2).toBeVisible();
  await monBtn2.click();
  const submitBtn2 = page.getByRole("button", { name: /Submit Votes/i });
  await submitBtn2.click();
  await expect(page.getByText(/submitted successfully|Response submitted/i)).toBeVisible({ timeout: 10000 });

  // Step 5: Navigate back to the group page and assert the viable day is rendered correctly
  await page.goto("http://localhost:4321/g/e2e-campaign-group-e2etst");
  await expect(page.getByText("✓ Viable: Mon")).toBeVisible();
});
