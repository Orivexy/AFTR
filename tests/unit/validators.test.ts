import { describe, expect, it } from "vitest";
import { commentSchema, eventInputSchema, postInputSchema, registerSchema, reviewSchema, usernameSchema } from "@/lib/validators";

const validEvent = {
  title: "FM Gràcia",
  category: "fm",
  genres: ["reggaeton"],
  citySlug: "barcelona",
  locationName: "Plaça del Sol",
  lat: 41.4,
  lng: 2.15,
  date: "2026-09-25",
  startTime: "22:00",
  endTime: "05:00",
  isFree: true,
};

describe("validators", () => {
  it("accepts a valid event", () => expect(eventInputSchema.safeParse(validEvent).success).toBe(true));
  it("requires a price for paid events", () => {
    const r = eventInputSchema.safeParse({ ...validEvent, isFree: false });
    expect(r.success).toBe(false);
  });
  it("rejects unknown categories and bad times", () => {
    expect(eventInputSchema.safeParse({ ...validEvent, category: "rave" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...validEvent, startTime: "24:10" }).success).toBe(false);
  });
  it("only allows https ticket links", () => {
    expect(eventInputSchema.safeParse({ ...validEvent, ticketUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...validEvent, ticketUrl: "https://tickets.example/x" }).success).toBe(true);
  });
  it("validates usernames", () => {
    expect(usernameSchema.parse(" Eric_BCN ")).toBe("eric_bcn");
    expect(usernameSchema.safeParse("a").success).toBe(false);
    expect(usernameSchema.safeParse("eric..x").success).toBe(false);
    expect(usernameSchema.safeParse("<script>").success).toBe(false);
  });
  it("enforces password strength and honeypot", () => {
    const base = { email: "a@b.co", username: "abc", displayName: "A" };
    expect(registerSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "onlyletters" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "letters123" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "letters123", website: "http://spam" }).success).toBe(false);
  });
  it("reviews are 1–5", () => {
    expect(reviewSchema.safeParse({ rating: 5 }).success).toBe(true);
    expect(reviewSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 4, music: 6 }).success).toBe(false);
  });
  it("posts need photos xor a video", () => {
    expect(postInputSchema.safeParse({ photoIds: [] }).success).toBe(false);
    expect(postInputSchema.safeParse({ photoIds: ["cabcdefghij12"], videoId: "cabcdefghij13" }).success).toBe(false);
    expect(postInputSchema.safeParse({ videoId: "cabcdefghij13" }).success).toBe(true);
  });
  it("comments are trimmed and non-empty", () => {
    expect(commentSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(commentSchema.parse({ body: "  hola  " }).body).toBe("hola");
  });
});
