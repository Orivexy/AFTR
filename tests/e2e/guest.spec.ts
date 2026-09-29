import { expect, test } from "@playwright/test";
import { TONIGHT, TOMORROW, VENUE } from "./helpers";

test.describe("guest browsing", () => {
  test("home shows tonight's real events", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /¿Qué hay hoy\?/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hoy", exact: true })).toBeVisible();
    await expect(page.getByText(TONIGHT.title).first()).toBeVisible();
    await expect(page.getByText(/en Barcelona/).first()).toBeVisible();
  });

  test("event detail and auth gate on 'Voy'", async ({ page }) => {
    await page.goto(`/events/${TONIGHT.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: TONIGHT.title })).toBeVisible();
    await page.getByRole("button", { name: /Voy/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("venue profile", async ({ page }) => {
    await page.goto(`/venues/${VENUE.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: VENUE.name })).toBeVisible();
    await expect(page.getByText("Próximos eventos")).toBeVisible();
    await expect(page.getByText(TOMORROW.title).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Gestionar ficha" })).toHaveCount(0);
  });

  test("discover filters work with real data", async ({ page }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Gratis" }).click();
    await expect(page).toHaveURL(/price=free/);
    await expect(page.getByText(TONIGHT.title).first()).toBeVisible();
    await expect(page.getByText(TOMORROW.title)).toHaveCount(0);

    await page.goto("/discover?category=concierto");
    await expect(page.getByText(TOMORROW.title).first()).toBeVisible();
    await expect(page.getByText(TONIGHT.title)).toHaveCount(0);

    await page.goto("/discover?date=2031-01-15");
    await expect(page.getByText("No hay eventos disponibles para esta fecha.")).toBeVisible();
  });

  test("map shows the venue", async ({ page }) => {
    await page.goto("/map");
    const pins = page.locator(".nx-pin-place");
    await expect(pins.first()).toBeAttached();
    await pins.first().dispatchEvent("click");
    await expect(page.getByRole("link", { name: /Cómo llegar/ })).toBeVisible();
  });

  test("search finds venues and events (accent-insensitive)", async ({ page }) => {
    await page.goto("/search?q=prueba");
    await expect(page.getByText(VENUE.name).first()).toBeVisible();
    await page.goto(`/search?q=${encodeURIComponent("gracia")}`);
    await expect(page.getByText(VENUE.name).first()).toBeVisible();
  });

  test("empty feed shows a real empty state", async ({ page }) => {
    await page.goto("/social");
    await expect(page.locator("body")).not.toContainText(/lorem|demo/i);
  });

  test("admin and private pages redirect to login", async ({ page }) => {
    for (const path of ["/admin", "/settings", "/business", "/events/new", `/venues/${VENUE.slug}/manage`]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("password recovery explains when email is not configured", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("status").filter({ hasText: /no tiene configurado el envío de emails/ })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    const res = await page.request.post("/api/auth/password/forgot", { data: { email: "someone@example.com" } });
    expect(res.status()).toBe(503);
  });
});
