import { expect, test } from "@playwright/test";
import path from "node:path";

const fixtureA = path.resolve("test-fixtures", "Arma 3 Preset 4th MEU V8.html");
const fixtureB = path.resolve("test-fixtures", "16th_Savlarian_V2.html");

async function uploadFixtures(page: import("@playwright/test").Page) {
  await page.getByLabel("Upload File A Arma preset or modlist").setInputFiles(fixtureA);
  await page.getByLabel("Upload File B Arma preset or modlist").setInputFiles(fixtureB);
}

test.beforeEach(async ({ page, context, browserName }) => {
  await page.goto("/");
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "http://127.0.0.1:4173"
    });
  }
});

test("loads fixtures and shows directional baseline labels", async ({ page }) => {
  await uploadFixtures(page);

  await expect(page.getByRole("heading", { name: /Only in 4th MEU V8/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Only in 16th_Savlarian_V2.html/i })).toBeVisible();

  await page.locator('input[name="currentSlot"]').first().click();
  await expect(page.getByRole("heading", { name: /Removed \(/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Added \(/i })).toBeVisible();
});

test("merge can be disabled by merge-none and re-enabled by merge-all", async ({ page }) => {
  await uploadFixtures(page);

  const mergeButton = page.getByRole("button", {
    name: "Merge selected mods and download HTML preset"
  });
  const onlyARegion = page.getByRole("region", { name: /Only in 4th MEU V8/i });
  const onlyBRegion = page.getByRole("region", { name: /Only in 16th_Savlarian_V2.html/i });
  const onlyAMergeCheckbox = onlyARegion
    .getByRole("checkbox", { name: /in merged output/i })
    .first();
  const onlyBMergeCheckbox = onlyBRegion
    .getByRole("checkbox", { name: /in merged output/i })
    .first();

  await expect(mergeButton).toBeEnabled();
  await expect(onlyAMergeCheckbox).toBeChecked();
  await expect(onlyBMergeCheckbox).toBeChecked();

  await page.getByTestId("merge-none-onlyInA").click();
  await expect(onlyAMergeCheckbox).not.toBeChecked();

  await page.getByTestId("merge-none-onlyInB").click();
  await expect(onlyBMergeCheckbox).not.toBeChecked();

  await expect(mergeButton).toBeDisabled();
  await expect(
    page.getByText("All merge checkboxes are unchecked. Select at least one mod to merge.")
  ).toBeVisible();

  await page.getByTestId("merge-all-onlyInA").click();
  await expect(mergeButton).toBeEnabled();
});

test("merge export triggers downloadable html file", async ({ page }) => {
  await uploadFixtures(page);

  await page.getByRole("textbox", { name: "Merged Name" }).fill("Session15 Merge");
  await page.getByRole("radio", { name: "Export as Modlist" }).check();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Merge selected mods and download HTML preset" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("Session15 Merge.html");
  await expect(page.getByText(/Merged \d+ mods into Session15 Merge.html\./)).toBeVisible();
});

test("copy output updates status and discord toggle renders", async ({ page, browserName }) => {
  await uploadFixtures(page);

  await page.getByRole("button", { name: "Copy to Clipboard" }).click();
  await expect(page.getByText(/Copied current output to clipboard.|Clipboard copy failed./)).toBeVisible();

  await page.getByRole("checkbox", { name: "Format for Discord" }).check();
  await expect(page.getByLabel("Formatted diff output")).toHaveValue(/\*\*.+\(\d+\)\*\*/);

  if (browserName === "chromium") {
    await page.getByRole("button", { name: "Copy for Discord" }).click();
    const copied = await page.evaluate(async () => navigator.clipboard.readText());
    expect(copied.length).toBeGreaterThan(0);
  }
});

test("same fixture in both inputs shows no differences", async ({ page }) => {
  await page.getByLabel("Upload File A Arma preset or modlist").setInputFiles(fixtureA);
  await page.getByLabel("Upload File B Arma preset or modlist").setInputFiles(fixtureA);

  await expect(page.getByText("Both uploaded files appear to be identical.")).toBeVisible();
  await expect(page.getByLabel("Formatted diff output")).toHaveValue("No differences found.");
});
