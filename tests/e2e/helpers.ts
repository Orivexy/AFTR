import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@e2e.test", password: "e2e-admin-pass-123", username: "e2eadmin" };
export const PASSWORD = "e2e-pass-1234";
export const VENUE = { slug: "sala-prueba-e2e", name: "Sala Prueba E2E" };
export const TONIGHT = { slug: "noche-prueba-e2e", title: "Noche Prueba E2E" };
export const TOMORROW = { slug: "concierto-prueba-e2e", title: "Concierto Prueba E2E" };

let counter = 0;
export function uniqueName(prefix = "e2e") {
  return `${prefix}${Date.now().toString(36).slice(-5)}${counter++}`;
}

/** Creates an account through the public API; the request context keeps the session cookie. */
export async function registerApi(request: APIRequestContext, name = uniqueName()) {
  const res = await request.post("/api/auth/register", { data: { email: `${name}@example.com`, password: PASSWORD, username: name, displayName: `Tester ${name}` } });
  expect(res.status(), await res.text()).toBeLessThan(300);
  const { user } = (await (await request.get("/api/auth/me")).json()) as { user: { id: string } };
  return { name, email: `${name}@example.com`, id: user.id };
}

export async function loginApi(request: APIRequestContext, email: string, password = PASSWORD) {
  const res = await request.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), await res.text()).toBe(200);
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** A tiny valid JPEG generated on the fly. */
export async function jpeg(color = "#ff3d7f"): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 900, height: 1200, channels: 3, background: color } }).jpeg().toBuffer();
}

export async function uploadPhoto(request: APIRequestContext) {
  const res = await request.post("/api/uploads", { multipart: { kind: "image", file: { name: "p.jpg", mimeType: "image/jpeg", buffer: await jpeg() } } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as { id: string; key: string };
}

export async function createPostApi(request: APIRequestContext, caption: string) {
  const photo = await uploadPhoto(request);
  const res = await request.post("/api/posts", { data: { caption, photoIds: [photo.id] } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as { id: string };
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible();
}

/** YYYY-MM-DD `days` from today (events can be at most a year ahead). */
export function futureDate(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
