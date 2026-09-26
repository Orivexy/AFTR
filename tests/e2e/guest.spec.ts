import { expect, test } from "@playwright/test";

test.describe("guest browsing", () => {
  test("home shows tonight in Barcelona", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /¿Qué hay hoy\?/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hoy", exact: true })).toBeVisible();
    await expect(page.getByText("Discotecas populares")).toBeVisible();
    await expect(page.getByText(/en Barcelona/)).toBeVisible();
  });

  test("event detail and auth gate on 'Voy'", async ({ page }) => {
    await page.goto("/discover?when=today");
    await page.locator('a[href^="/events/"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Entrada")).toBeVisible();
    await page.getByRole("button", { name: /Voy/ }).click();
    await expect(page.getByRole("dialog", { name: "Entra en la noche" })).toBeVisible();
  });

  test("venue profile with reviews and gallery", async ({ page }) => {
    await page.goto("/venues/sala-x");
    await expect(page.getByRole("heading", { name: "Sala X" })).toBeVisible();
    await expect(page.getByText("Fotos de la comunidad")).toBeVisible();
    await expect(page.getByText(/valoraciones/).first()).toBeVisible();
  });

  test("map renders places and opens a place card", async ({ page }) => {
    await page.goto("/map");
    const pins = page.locator(".nx-pin-place");
    await expect(pins.first()).toBeAttached();
    await pins.first().dispatchEvent("click");
    await expect(page.getByRole("link", { name: /Ver perfil/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Cómo llegar/ })).toBeVisible();
  });

  test("map filters and search update list and map together", async ({ page }) => {
    await page.goto("/map?when=today");
    // Desktop and mobile layouts each have a search box: use the visible one.
    const search = page.getByLabel("Buscar en el mapa").filter({ visible: true });
    const count = async () => Number((await page.getByText(/\d+ (resultados?|en )/).filter({ visible: true }).first().innerText()).match(/\d+/)![0]);
    const before = await count();
    await search.fill("techno");
    await expect.poll(count).toBeLessThanOrEqual(before);
    await search.fill("zzzz-nada");
    await expect.poll(count).toBe(0);
  });

  test("search understands intents", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent("fiesta hoy")}`);
    await expect(page.getByText("Buscando:")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver en el mapa/ })).toBeVisible();
  });

  test("accent-insensitive search", async ({ page }) => {
    await page.goto("/search?q=gracia");
    await expect(page.getByText("Zonas")).toBeVisible();
    await expect(page.getByText("FM Gràcia").first()).toBeVisible();
  });

  test("vertical feed loads posts", async ({ page }) => {
    await page.goto("/social");
    await expect(page.locator("article").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Me gusta" }).first()).toBeVisible();
  });

  test("discover filters are URL-driven", async ({ page }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "Gratis" }).click();
    await expect(page).toHaveURL(/price=free/);
  });
});
