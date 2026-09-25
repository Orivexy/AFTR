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
});

test("regular users cannot open the admin panel", async ({ page }) => {
  await login(page, "irene@nightly.demo");
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
});
