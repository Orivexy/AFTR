import { expect, test } from "@playwright/test";
import { ADMIN, TONIGHT, VENUE, login } from "./helpers";

/**
 * Every public page at phone / tablet / desktop widths: no horizontal
 * overflow, no console errors, no failed same-origin requests, no broken links.
 */
const PAGES = ["/", "/discover", "/discover?when=today", "/events", "/map", "/social", "/search?q=prueba", "/venues", `/venues/${VENUE.slug}`, `/events/${TONIGHT.slug}`, "/people", "/login", "/register", "/forgot-password"];
const WIDTHS = [360, 768, 1440];

for (const width of WIDTHS) {
  test(`pages render cleanly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // Third-party map tiles are not part of the app (and the test runner may be offline).
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ status: 204, body: "" }));
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("response", (r) => {
      const url = new URL(r.url());
      if (url.origin === new URL(page.url() || "http://x").origin && r.status() >= 500) problems.push(`${r.status()} ${url.pathname}`);
    });
    for (const path of PAGES) {
      const res = await page.goto(path, { waitUntil: "networkidle" });
      expect(res?.status(), path).toBeLessThan(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${path} overflows horizontally by ${overflow}px`);
    }
    expect(problems).toEqual([]);
  });
}

test("internal links resolve", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const path of ["/", "/discover", `/venues/${VENUE.slug}`, `/events/${TONIGHT.slug}`]) {
    await page.goto(path);
    const hrefs = await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")!));
    for (const href of hrefs) seen.add(href.split("#")[0]!);
  }
  const broken: string[] = [];
  for (const href of seen) {
    if (href.startsWith("/api/") || href.startsWith("/media/")) continue;
    const res = await request.get(href, { maxRedirects: 5 });
    if (res.status() >= 400) broken.push(`${res.status()} ${href}`);
  }
  expect(broken).toEqual([]);
});

const PRIVATE_PAGES = ["/settings", "/business", "/notifications", "/events/new", "/create/post?type=photo", `/venues/${VENUE.slug}/manage`, "/me"];
const ADMIN_PAGES = ["/admin", "/admin/reports", "/admin/events", "/admin/discovery", "/admin/map-data", "/admin/event-data", "/admin/users", "/admin/venues", "/admin/posts", "/admin/businesses", "/admin/monetization", "/admin/orders", "/admin/promotions", "/admin/audit", "/admin/settings"];

for (const width of [360, 768]) {
  test(`signed-in and admin pages render cleanly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ status: 204, body: "" }));
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    await login(page, ADMIN.email, ADMIN.password);
    for (const path of [...PRIVATE_PAGES, ...ADMIN_PAGES]) {
      const res = await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      expect(res?.status(), path).toBeLessThan(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${path} overflows horizontally by ${overflow}px`);
    }
    expect(problems).toEqual([]);
  });
}
