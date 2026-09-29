import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { signV4, canonicalQuery } = await import("@/server/storage/s3");
const { assertKey, contentTypeFor } = await import("@/server/storage/keys");

// Official examples from the AWS S3 Signature V4 documentation.
const creds = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", date: new Date("2013-05-24T00:00:00Z") };
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("S3 Signature V4", () => {
  it("signs GET Object with Range like AWS", () => {
    const h = signV4({ ...creds, method: "GET", url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"), headers: { Range: "bytes=0-9" }, payloadHash: EMPTY });
    expect(h.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("signs ListObjects with a canonical query like AWS", () => {
    const q = canonicalQuery({ prefix: "J", "max-keys": "2" });
    expect(q).toBe("max-keys=2&prefix=J");
    const h = signV4({ ...creds, method: "GET", url: new URL(`https://examplebucket.s3.amazonaws.com/?${q}`), headers: {}, payloadHash: EMPTY });
    expect(h.authorization).toMatch(/Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/);
  });
});

describe("storage keys", () => {
  it("rejects traversal and odd characters", () => {
    expect(() => assertKey("img/ab/abc_sm.webp")).not.toThrow();
    for (const bad of ["../etc/passwd", "img/../../x.webp", "/abs.webp", "img/a b.webp", ""]) expect(() => assertKey(bad)).toThrow();
  });
  it("only serves known media types", () => {
    expect(contentTypeFor("img/x_sm.webp")).toBe("image/webp");
    expect(contentTypeFor("vid/x.mp4")).toBe("video/mp4");
    expect(contentTypeFor("x.html")).toBeNull();
  });
});
