import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "nightly123";

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export function uniqueName(prefix = "e2e") {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

/** A tiny valid JPEG generated on the fly. */
export async function jpeg(color = "#ff3d7f"): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({ create: { width: 900, height: 1200, channels: 3, background: color } }).jpeg().toBuffer();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}
