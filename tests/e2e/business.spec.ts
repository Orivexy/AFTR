import { expect, test } from "@playwright/test";
import { ADMIN, VENUE, futureDate, login, registerApi } from "./helpers";

test("venue account: request → admin approval → manage profile → official event", async ({ page, browser }) => {
  // The venue owner asks for a venue account.
  const owner = await registerApi(page.request);
  const venues = (await (await page.request.get(`/api/venues?q=prueba`)).json()) as { items: Array<{ id: string; slug: string }> };
  const venue = venues.items.find((v) => v.slug === VENUE.slug)!;
  const req = await page.request.post("/api/me/business", { data: { type: "VENUE", tradeName: VENUE.name, venueId: venue.id, message: "Soy el gerente, escribid a info@salaprueba.test" } });
  expect(req.status(), await req.text()).toBe(200);
  await page.goto("/business");
  await expect(page.getByText(/pendiente|revisión/i).first()).toBeVisible();

  // Not yet allowed to manage the venue.
  expect((await page.request.patch(`/api/venues/${venue.id}`, { data: { description: "x" } })).status()).toBe(403);

  // Admin approves.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN.email, ADMIN.password);
  await admin.goto("/admin/businesses");
  await admin.getByRole("button", { name: "Aprobar" }).first().click();
  await expect(admin.getByText("Negocio verificado").first()).toBeVisible();
  await adminCtx.close();

  // The owner is notified and can now manage the venue profile.
  const notes = (await (await page.request.get("/api/notifications")).json()) as { items: Array<{ type: string }> };
  expect(notes.items.map((n) => n.type)).toContain("BUSINESS_APPROVED");
  await page.goto(`/venues/${VENUE.slug}`);
  await page.getByRole("link", { name: "Gestionar ficha" }).click();
  await page.waitForURL(/\/manage$/);
  await page.getByLabel("Descripción").fill("Techno toda la noche. Sesiones hasta las 6.");
  await page.getByLabel("Precio desde (€)").fill("10");
  await page.getByLabel("Hasta (€)").fill("20");
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  await page.waitForURL(`/venues/${VENUE.slug}`);
  await expect(page.getByText("Techno toda la noche. Sesiones hasta las 6.")).toBeVisible();
  await expect(page.getByText(/Oficial/).first()).toBeVisible();

  // Events of a verified venue are published immediately as official.
  const ev = await page.request.post("/api/events", {
    data: { title: `Oficial ${owner.name}`, category: "discoteca", genres: ["techno"], citySlug: "barcelona", venueId: venue.id, locationName: VENUE.name, lat: 41.4036, lng: 2.1571, date: futureDate(40), startTime: "23:30", endTime: "06:00", isFree: false, price: 15 },
  });
  expect(ev.status(), await ev.text()).toBe(200);
  expect(((await ev.json()) as { status: string }).status).toBe("PUBLISHED");

  // Validation: price max below min is rejected.
  const bad = await page.request.patch(`/api/venues/${venue.id}`, { data: { priceMin: 30, priceMax: 10 } });
  expect(bad.status()).toBe(400);
});
