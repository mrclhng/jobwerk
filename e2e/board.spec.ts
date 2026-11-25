import { expect, test, type Page } from "@playwright/test";
import { resetApplications } from "./fixtures";

test.beforeEach(async () => {
  await resetApplications();
});

const column = (page: Page, status: string) => page.getByRole("region", { name: status, exact: true });
const card = (page: Page, firma: string) => page.getByRole("article").filter({ hasText: firma });

test("leitet ohne Login zur Anmeldung um", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Mit GitHub anmelden" })).toBeVisible();
  await context.close();
});

test("zeigt Spalten, Karten und fällige Nachfass-Termine", async ({ page }) => {
  await page.goto("/");
  for (const status of ["Vorschlag", "Interessant", "Beworben", "Interview", "Angebot"]) {
    await expect(column(page, status)).toBeVisible();
  }
  await expect(column(page, "Vorschlag").getByText("Beispiel AG")).toBeVisible();
  await expect(card(page, "Demo KG").getByText("Nachfassen fällig")).toBeVisible();
});

test("verschiebt per Pfeil-Button und macht es rückgängig", async ({ page }) => {
  await page.goto("/");
  await card(page, "Muster GmbH").getByRole("button", { name: "Weiter nach Beworben" }).click();

  const moved = column(page, "Beworben").getByRole("article").filter({ hasText: "Muster GmbH" });
  await expect(moved).toBeVisible();
  await expect(moved.getByText(/beworben \d{2}\.\d{2}\.\d{4}/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Muster GmbH: Beworben" })).toBeVisible();

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(column(page, "Interessant").getByText("Muster GmbH")).toBeVisible();
  await page.reload();
  await expect(column(page, "Interessant").getByText("Muster GmbH")).toBeVisible();
});

test("verschiebt per Drag & Drop mit der Maus", async ({ page }) => {
  await page.goto("/");
  const source = card(page, "Muster GmbH");
  const target = column(page, "Interview");
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + 20, from.y + 15);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
  await page.mouse.up();

  await expect(column(page, "Interview").getByText("Muster GmbH")).toBeVisible();
  await page.reload();
  await expect(column(page, "Interview").getByText("Muster GmbH")).toBeVisible();
});

test("verschiebt per Tastatur (Leertaste, Pfeil, Leertaste)", async ({ page }) => {
  await page.goto("/");
  await card(page, "Muster GmbH").focus();
  const live = page.locator("[aria-live=assertive]");
  await page.keyboard.press("Space");
  await expect(live).toContainText("über Spalte Interessant");
  // dnd-kit hängt den Keydown-Listener erst im nächsten Tick an – ein sofortiger
  // Tastendruck kann verpuffen (bei Menschen nie, bei Testautomaten schon).
  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(live).toContainText("über Spalte Beworben", { timeout: 1000 });
  }).toPass();
  await page.keyboard.press("Space");
  await expect(column(page, "Beworben").getByText("Muster GmbH")).toBeVisible();
});

test("verwirft Vorschläge mit Grund und holt sie zurück", async ({ page }) => {
  await page.goto("/");
  await card(page, "Beispiel AG").getByRole("button", { name: "Passt nicht" }).click();
  await page.getByRole("textbox", { name: "Grund" }).fill("nur Präsenz");
  await page.getByRole("button", { name: "Verwerfen" }).click();

  await expect(column(page, "Vorschlag").getByText("Beispiel AG")).toHaveCount(0);
  await page.locator("summary", { hasText: "Archiv" }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Beispiel AG" });
  await expect(row.getByText("Grund: nur Präsenz")).toBeVisible();
  await expect(row.getByText("Verworfen", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Zurückholen" }).click();
  await expect(column(page, "Vorschlag").getByText("Beispiel AG")).toBeVisible();
});

test("holt Absagen in die vorherige Spalte zurück", async ({ page }) => {
  await page.goto("/");
  await page.locator("summary", { hasText: "Archiv" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Archiv SE" })
    .getByRole("button", { name: "Zurückholen" })
    .click();
  await expect(column(page, "Interview").getByText("Archiv SE")).toBeVisible();
});

test("legt eine Bewerbung an und bearbeitet sie", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Bewerbung hinzufügen" }).click();
  const dialog = page.getByRole("dialog", { name: "Neue Bewerbung" });
  await dialog.getByLabel("Firma", { exact: true }).fill("Neue Firma GmbH");
  await dialog.getByLabel("Stelle", { exact: true }).fill("React-Entwickler");
  await dialog.getByLabel("Status", { exact: true }).selectOption("Beworben");
  await expect(dialog.getByLabel("Beworben am", { exact: true })).not.toHaveValue("");
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toBeHidden();
  await expect(column(page, "Beworben").getByText("Neue Firma GmbH")).toBeVisible();

  await card(page, "Neue Firma GmbH").getByRole("button", { name: "Bearbeiten" }).click();
  const edit = page.getByRole("dialog", { name: "Neue Firma GmbH bearbeiten" });
  await edit.getByLabel("Notizen", { exact: true }).fill("Erstgespräch am Montag");
  await edit.getByLabel("Link zur Anzeige", { exact: true }).fill("kein-link");
  await edit.getByRole("button", { name: "Speichern" }).click();
  // Browser-Validierung (type=url) verhindert das Absenden
  await expect(edit).toBeVisible();
  expect(
    await edit
      .getByLabel("Link zur Anzeige", { exact: true })
      .evaluate((el) => (el as HTMLInputElement).validity.valid),
  ).toBe(false);
  await edit.getByLabel("Link zur Anzeige", { exact: true }).fill("https://jobs.example.com/neu");
  await edit.getByRole("button", { name: "Speichern" }).click();
  await expect(edit).toBeHidden();
  await expect(card(page, "Neue Firma GmbH").getByRole("link", { name: "React-Entwickler" })).toHaveAttribute(
    "href",
    "https://jobs.example.com/neu",
  );
});

test("erstellt ein MCP-Token, das am /mcp-Endpunkt funktioniert", async ({ page, request }) => {
  await page.goto("/einstellungen");
  await page.getByLabel("Name").fill("Playwright");
  await page.getByRole("button", { name: "Token erstellen" }).click();
  const token = (await page.locator("code.select-all").textContent())!.trim();
  expect(token).toMatch(/^jw_/);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  const res = await request.post("/mcp", {
    headers,
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_applications", arguments: { status: "Vorschlag" } },
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(JSON.parse(body.result.content[0].text)).toEqual([
    expect.objectContaining({ firma: "Beispiel AG" }),
  ]);

  await page.getByRole("button", { name: "Widerrufen" }).click();
  await expect(page.getByText("Noch keine Tokens.")).toBeVisible();
  const denied = await request.post("/mcp", {
    headers,
    data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
  });
  expect(denied.status()).toBe(401);
});
