import { expect, test } from "@playwright/test";
import { resetApplications } from "./fixtures";

test.beforeEach(async () => {
  await resetApplications();
});

test("Board ist mobil horizontal scrollbar, ohne dass die Seite seitlich scrollt", async ({ page }) => {
  await page.goto("/");
  const board = page.getByRole("main", { name: "Bewerbungs-Board" });
  await expect(board).toBeVisible();

  const { boardScrolls, pageScrolls } = await board.evaluate((el) => ({
    boardScrolls: el.scrollWidth > el.clientWidth,
    pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  expect(boardScrolls).toBe(true);
  expect(pageScrolls).toBe(false);

  // Pfeil-Buttons funktionieren auch auf Touch-Geräten
  await page
    .getByRole("article")
    .filter({ hasText: "Muster GmbH" })
    .getByRole("button", { name: "Weiter nach Beworben" })
    .tap();
  await expect(
    page.getByRole("region", { name: "Beworben", exact: true }).getByText("Muster GmbH"),
  ).toBeVisible();
});
