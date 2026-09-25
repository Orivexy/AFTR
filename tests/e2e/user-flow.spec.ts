import { expect, test } from "@playwright/test";
import { expectToast, jpeg, login, uniqueName } from "./helpers";

test.describe.configure({ mode: "serial" });

test("register → going → save → social → comment → follow → post → create event", async ({ page }) => {
  const name = uniqueName();

  // Register
  await page.goto("/register");
  await page.getByLabel("Nombre").fill("E2E Tester");
  await page.getByLabel("Usuario").fill(name);
  await page.getByLabel("Email").fill(`${name}@example.com`);
  await page.getByLabel("Contraseña", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.waitForURL("/");

  // Mark "Voy" on tonight's first event and save it
  await page.goto("/discover?when=today");
  await page.locator('a[href^="/events/"]').first().click();
  const going = page.getByRole("button", { name: /^Voy$/ });
  await going.click();
  await expect(page.getByRole("button", { name: /Vas/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Guardado", exact: true })).toBeVisible();

  // Like + comment in the feed
  await page.goto("/social");
  const first = page.locator("article").first();
  await first.getByRole("button", { name: "Me gusta" }).click();
  await expect(first.getByRole("button", { name: "Quitar like" })).toBeVisible();
  await first.getByRole("button", { name: "Comentarios" }).click();
  const dialog = page.getByRole("dialog", { name: "Comentarios" });
  await dialog.getByLabel("Comentario").fill(`¡Qué noche! ${name}`);
  await dialog.getByRole("button", { name: "Enviar" }).click();
  await expect(dialog.getByText(`¡Qué noche! ${name}`)).toBeVisible();
  await page.keyboard.press("Escape");

  // Follow a user from their profile
  await page.goto("/u/laia_bcn");
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByRole("button", { name: "Siguiendo" })).toBeVisible();

  // Publish a photo
  await page.goto("/create/post?type=photo");
  await page.locator('input[type="file"]').setInputFiles({ name: "night.jpg", mimeType: "image/jpeg", buffer: await jpeg() });
  await expect(page.getByText("Portada")).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder("Anoche en Gràcia 🔥").fill(`Test post ${name}`);
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.waitForURL(/\/social\?post=/);
  await expect(page.getByText(`Test post ${name}`)).toBeVisible();

  // Create an event (new accounts go to review)
  await page.goto("/events/new");
  await page.getByLabel("Título").fill(`E2E Party ${name}`);
  await page.getByLabel("Nombre del lugar").fill("Plaça de la Virreina");
  await page.getByRole("button", { name: "Publicar evento" }).click();
  await page.waitForURL(/\/events\/e2e-party/);
  await expect(page.getByText(/Pendiente de revisión/)).toBeVisible();

  // Profile shows the post; notifications page loads
  await page.goto(`/u/${name}`);
  await expect(page.getByRole("heading", { name: "E2E Tester" })).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
});

test("reviews: one per user, editable", async ({ page }) => {
  await login(page, "juliam@nightly.demo");
  await page.goto("/venues/pulso");
  const cta = page.getByRole("button", { name: /Valorar Pulso|Editar tu valoración/ });
  await cta.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "4 estrellas" }).first().click();
  await dialog.getByPlaceholder("Cuéntanos qué tal (opcional)").fill("Muy buen hip hop");
  await dialog.getByRole("button", { name: /Publicar valoración|Guardar cambios/ }).click();
  await expectToast(page, /valoración/i);
  await expect(page.getByRole("button", { name: "Editar tu valoración" })).toBeVisible();
});

test("report content", async ({ page }) => {
  await login(page, "hugo@nightly.demo");
  await page.goto("/social");
  const first = page.locator("article").first();
  await first.getByRole("button", { name: "Más opciones" }).click();
  await page.getByRole("button", { name: /Reportar publicación|Eliminar publicación/ }).first().click();
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) {
    await dialog.getByRole("button", { name: "Spam" }).click();
    await dialog.getByRole("button", { name: "Enviar reporte" }).click();
    await expectToast(page, /revisará|Ya habías/);
  }
});
