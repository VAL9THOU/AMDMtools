import { expect, test } from "@playwright/test";
import path from "node:path";

const fixtureA = path.resolve("test-fixtures", "Arma 3 Preset 4th MEU V8.html");
const fixtureB = path.resolve("test-fixtures", "16th_Savlarian_V2.html");

async function uploadFixtures(page: import("@playwright/test").Page) {
  await page.getByLabel("Upload File A Arma preset or modlist").setInputFiles(fixtureA);
  await page.getByLabel("Upload File B Arma preset or modlist").setInputFiles(fixtureB);
}

test.describe("mod sizes feature", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the proxy endpoint so tests don't require a live Worker
    await page.route("**/localhost:8787**", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { steamIds?: string[] };
      const sizes: Record<string, number> = {};
      for (const id of body.steamIds ?? []) {
        // Return 100 MB for each mod for predictable testing
        sizes[id] = 104_857_600;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sizes, partial: false })
      });
    });
    await page.goto("/");
  });

  test("include mod sizes checkbox is unchecked by default", async ({ page }) => {
    await uploadFixtures(page);

    const checkbox = page.getByLabel("Include mod sizes");
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test("no sizes displayed when checkbox is unchecked", async ({ page }) => {
    await uploadFixtures(page);

    await expect(page.locator(".mod-size")).toHaveCount(0);
    await expect(page.locator(".section-size")).toHaveCount(0);
  });

  test("sizes appear after enabling checkbox", async ({ page }) => {
    await uploadFixtures(page);

    await page.getByLabel("Include mod sizes").check();

    // Wait for sizes to load and appear
    await expect(page.locator(".mod-size").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".section-size").first()).toBeVisible();
  });

  test("steam API warning is visible next to checkbox", async ({ page }) => {
    await uploadFixtures(page);

    await expect(page.locator(".size-warning")).toContainText("Steam Web API");
  });

  test("formatted output includes sizes when enabled", async ({ page }) => {
    await uploadFixtures(page);
    await page.getByLabel("Include mod sizes").check();

    // Wait for sizes to load
    await expect(page.locator(".mod-size").first()).toBeVisible({ timeout: 10000 });

    // Check output textarea contains size brackets
    const output = await page.getByLabel("Formatted diff output").inputValue();
    expect(output).toContain("[");
    expect(output).toContain("MB");
  });

  test("sizes disappear after unchecking checkbox", async ({ page }) => {
    await uploadFixtures(page);

    await page.getByLabel("Include mod sizes").check();
    await expect(page.locator(".mod-size").first()).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Include mod sizes").uncheck();
    await expect(page.locator(".mod-size")).toHaveCount(0);
  });
});
