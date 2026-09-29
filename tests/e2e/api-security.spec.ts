import { expect, test } from "@playwright/test";
import { VENUE, createPostApi, registerApi } from "./helpers";

test.describe("API security", () => {
  test("mutations require a session", async ({ request }) => {
    expect((await request.post("/api/posts", { data: { photoIds: ["abcdefghijkl"] } })).status()).toBe(401);
    expect((await request.post("/api/uploads", { multipart: { kind: "image" } })).status()).toBe(401);
  });

  test("cross-origin mutations are rejected", async ({ request }) => {
    await registerApi(request);
    const res = await request.put("/api/events/abcdefghijkl/save", { data: { saved: true }, headers: { origin: "https://evil.example" } });
    expect(res.status()).toBe(403);
  });

  test("uploads are validated by content, not extension or MIME", async ({ request }) => {
    await registerApi(request);
    const res = await request.post("/api/uploads", { multipart: { kind: "image", file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") } } });
    expect(res.status()).toBe(400);
  });

  test("users cannot delete or edit what isn't theirs (IDOR)", async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    await registerApi(a.request);
    await registerApi(b.request);
    const post = await createPostApi(a.request, "de A");
    expect((await b.request.delete(`/api/posts/${post.id}`)).status()).toBe(403);
    const venues = (await (await b.request.get("/api/venues?q=prueba")).json()) as { items: Array<{ id: string; slug: string }> };
    const venue = venues.items.find((v) => v.slug === VENUE.slug)!;
    expect((await b.request.patch(`/api/venues/${venue.id}`, { data: { name: "Hackeado" } })).status()).toBe(403);
    // B can't attach A's uploaded photo to its own post.
    const up = await a.request.post("/api/uploads", { multipart: { kind: "image", file: { name: "a.jpg", mimeType: "image/jpeg", buffer: await (await import("./helpers")).jpeg() } } });
    const photo = (await up.json()) as { id: string };
    expect((await b.request.post("/api/posts", { data: { photoIds: [photo.id] } })).status()).toBe(400);
    await a.close();
    await b.close();
  });

  test("role escalation is impossible from the client", async ({ request }) => {
    const u = await registerApi(request);
    expect((await request.patch(`/api/admin/users/${u.id}`, { data: { role: "ADMIN" } })).status()).toBe(403);
    expect((await request.patch("/api/me/profile", { data: { role: "ADMIN" } })).status()).toBeLessThan(500);
    const me = (await (await request.get("/api/auth/me")).json()) as { user: { role: string } };
    expect(me.user.role).toBe("USER");
  });

  test("cron endpoints need the secret", async ({ request }) => {
    expect((await request.post("/api/cron/event-sync")).status()).toBe(401);
    expect((await request.post("/api/cron/event-sync", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });

  test("media does not serve arbitrary paths", async ({ request }) => {
    expect((await request.get("/media/..%2F..%2Fetc%2Fpasswd")).status()).toBe(404);
    expect((await request.get("/media/img/aa/nothing_sm.webp")).status()).toBe(404);
    expect((await request.get("/media/package.json")).status()).toBe(404);
  });

  test("login is rate limited", async ({ request }) => {
    let limited = false;
    for (let i = 0; i < 20 && !limited; i++) {
      const res = await request.post("/api/auth/login", { data: { email: "ratelimit@example.com", password: "wrong-password1" } });
      limited = res.status() === 429;
    }
    expect(limited).toBe(true);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
