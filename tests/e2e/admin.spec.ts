import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin panel is protected and usable", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);

  await login(page, "admin@nightly.demo");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await page.goto("/admin/events");
  await expect(page.getByRole("heading", { name: "Eventos" })).toBeVisible();
  await page.goto("/admin/users?q=eric");
  await expect(page.getByText("@eric", { exact: true })).toBeVisible();
  await page.goto("/admin/venues");
  await expect(page.getByRole("link", { name: "Sala X" })).toBeVisible();
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
  await page.goto("/admin/map-data");
  await expect(page.getByRole("heading", { name: "Map Data" })).toBeVisible();
  await expect(page.getByText("VENUE_SYNC").first()).toBeVisible();
  await expect(page.getByText("Uso de APIs (30 días)")).toBeVisible();
  await page.goto("/admin/event-data");
  await expect(page.getByRole("heading", { name: "Event Data" })).toBeVisible();
  await expect(page.getByText("EVENT_SYNC").first()).toBeVisible();
});

test("regular users cannot open the admin panel", async ({ page }) => {
  await login(page, "irene@nightly.demo");
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
});
