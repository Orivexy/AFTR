import { expect, test } from "@playwright/test";
import { ADMIN, createPostApi, futureDate, login, registerApi, uniqueName } from "./helpers";

test.describe.configure({ mode: "serial" });

test("regular users cannot open the admin panel or its API", async ({ page }) => {
  await registerApi(page.request);
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
  for (const [method, url] of [["get", "/api/admin/stats"], ["patch", "/api/admin/settings"], ["post", "/api/admin/venues"]] as const) {
    const res = await page.request[method](url, { data: {} });
    expect(res.status(), url).toBe(403);
  }
});

test("admin flow: moderation, users, settings, venues, data", async ({ page, browser }) => {
  // A user creates content that needs moderation.
  const ctx = await browser.newContext();
  const author = await registerApi(ctx.request);
  const title = `Pendiente ${author.name}`;
  const created = await ctx.request.post("/api/events", {
    data: { title, category: "fiesta", genres: [], citySlug: "barcelona", locationName: "Plaça del Sol", lat: 41.4, lng: 2.15, date: futureDate(30), startTime: "23:00", endTime: "04:00", isFree: true },
  });
  expect(created.status()).toBe(200);
  expect(((await created.json()) as { status: string }).status).toBe("PENDING");
  const post = await createPostApi(ctx.request, `Reportable ${author.name}`);
  const reporter = await browser.newContext();
  await registerApi(reporter.request);
  expect((await reporter.request.post("/api/reports", { data: { targetType: "POST", targetId: post.id, reason: "SPAM" } })).status()).toBe(200);

  await login(page, ADMIN.email, ADMIN.password);

  // Dashboard
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  // Approve the pending event
  await page.goto("/admin/events?status=PENDING");
  const row = page.locator("div").filter({ hasText: title }).filter({ has: page.getByRole("button", { name: "Aprobar" }) }).last();
  await row.getByRole("button", { name: "Aprobar" }).click();
  await expect.poll(async () => ((await (await ctx.request.get(`/api/events?when=upcoming&limit=40`)).json()) as { items: Array<{ title: string }> }).items.length).toBeGreaterThan(0);

  // Resolve the report: remove the post
  await page.goto("/admin/reports");
  await expect(page.getByText(`Reportable ${author.name}`).first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Retirar" }).first().click();
  await expect.poll(async () => (await ctx.request.get(`/api/posts/${post.id}`)).status()).toBe(404);

  // Suspend and reactivate the author
  await page.goto(`/admin/users?q=${author.name}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Suspender" }).first().click();
  await expect(page.getByRole("button", { name: "Reactivar" }).first()).toBeVisible();
  expect((await ctx.request.get("/api/auth/me")).ok()).toBe(true);
  expect(((await (await ctx.request.get("/api/auth/me")).json()) as { user: unknown }).user).toBeNull();
  await page.getByRole("button", { name: "Reactivar" }).first().click();
  await expect(page.getByRole("button", { name: "Suspender" }).first()).toBeVisible();

  // Runtime settings: close registrations, verify, reopen
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Servicios" })).toBeVisible();
  await expect(page.getByText("Email (recuperar contraseña)")).toBeVisible();
  await page.getByLabel(/Registro abierto/).uncheck();
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ajustes guardados" }).first()).toBeVisible();
  const anon = await browser.newContext();
  const n = uniqueName("closed");
  const closed = await anon.request.post("/api/auth/register", { data: { email: `${n}@example.com`, password: "e2e-pass-1234", username: n, displayName: "X" } });
  expect(closed.status()).toBe(403);
  await page.getByLabel(/Registro abierto/).check();
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect.poll(async () => (await anon.request.post("/api/auth/register", { data: { email: `${n}@example.com`, password: "e2e-pass-1234", username: n, displayName: "X" } })).status()).toBe(200);

  // Create a venue by hand
  const venueName = `Local Manual ${uniqueName()}`;
  await page.goto("/admin/venues");
  await page.getByRole("button", { name: "Añadir local" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Nombre").fill(venueName);
  await sheet.getByLabel("Ciudad").selectOption("barcelona");
  await sheet.getByLabel("Dirección").fill("Carrer Nou 5");
  await sheet.getByLabel("Latitud").fill("41.39");
  await sheet.getByLabel("Longitud").fill("2.17");
  await sheet.getByRole("button", { name: "Crear local" }).click();
  await expect(page.getByRole("link", { name: venueName })).toBeVisible();

  // Data pages
  for (const [path, heading] of [["/admin/discovery", /Discovery/], ["/admin/map-data", "Map Data"], ["/admin/event-data", "Event Data"], ["/admin/audit", /auditoría/i], ["/admin/businesses", /Organizadores y locales/]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  }
  await ctx.close();
  await reporter.close();
  await anon.close();
});
