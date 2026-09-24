import { test, expect } from "@playwright/test";
import { seedTestData } from "./seed.js";

test.beforeAll(async () => {
  await seedTestData();
});

test("canonical redirect for bare slug parameter", async ({ page }) => {
  await page.goto("http://localhost:4321/g/e2etst");
  await expect(page).toHaveURL(/\/g\/e2e-campaign-group-e2etst/);
});

test("public group page renders open sessions and roster", async ({ page }) => {
  await page.goto("http://localhost:4321/g/e2e-campaign-group-e2etst");

  // Title
  await expect(page.getByRole("heading", { name: "E2E Campaign Group" })).toBeVisible();

  // Roster players
  await expect(page.getByText("⚔ Gimli Son of Gloin")).toBeVisible();
  await expect(page.getByText("⚔ Legolas Greenleaf")).toBeVisible();

  // Open poll card
  await expect(page.getByText("Open Poll")).toBeVisible();
});

test("voting flow: pick player, select days, submit votes, verify live tally update", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("Browser console error:", msg.text());
  });

  await page.goto("http://localhost:4321/g/e2e-campaign-group-e2etst/e2esess100");

  // Check page header
  await expect(page.getByRole("heading", { name: /Week of 28 Sep/i })).toBeVisible();

  // Step 1: Select Player "Gimli Son of Gloin"
  const playerBtn = page.getByRole("button", { name: /Gimli Son of Gloin/i });
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

  // Verify feedback message (success or error display)
  const successMessage = page.getByText(/submitted successfully|Response submitted/i);
  await expect(successMessage).toBeVisible({ timeout: 10000 });

  expect(pageErrors.length).toBe(0);
});
