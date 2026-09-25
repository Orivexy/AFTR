import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers";

test.describe("API security", () => {
  test("mutations require a session", async ({ request }) => {
    const res = await request.post("/api/posts", { data: { photoIds: ["abcdefghijkl"] } });
    expect(res.status()).toBe(401);
  });

  test("cross-origin mutations are rejected", async ({ request }) => {
    await request.post("/api/auth/login", { data: { email: "eric@nightly.demo", password: DEMO_PASSWORD } });
    const res = await request.put("/api/events/abcdefghijkl/save", { data: { saved: true }, headers: { origin: "https://evil.example" } });
    expect(res.status()).toBe(403);
  });

  test("uploads are validated by content, not extension", async ({ request }) => {
    await request.post("/api/auth/login", { data: { email: "eric@nightly.demo", password: DEMO_PASSWORD } });
    const res = await request.post("/api/uploads", {
      multipart: { kind: "image", file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") } },
    });
    expect(res.status()).toBe(400);
  });

  test("login is rate limited", async ({ request }) => {
    let limited = false;
    for (let i = 0; i < 14 && !limited; i++) {
      const res = await request.post("/api/auth/login", { data: { email: "ratelimit@example.com", password: "wrong-password1" } });
      limited = res.status() === 429;
    }
    expect(limited).toBe(true);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
