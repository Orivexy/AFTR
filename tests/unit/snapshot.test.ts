import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.DATABASE_URL ??= "postgresql://test@localhost:5432/test"; // env is validated on import; nothing connects
const { fetchJson, snapshotKey, withSnapshotReplay } = await import("@/server/discovery/fetcher");

describe("discovery snapshot replay", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "snap-"));
  const url = "https://datos.example.org/agenda.json";
  const key = snapshotKey("GET", url, undefined);
  writeFileSync(path.join(dir, `${key}.gz`), gzipSync(JSON.stringify({ "@graph": [{ id: "1" }] })));
  writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ url, contentType: "application/json" }));

  it("serves recorded responses inside the replay context, without network", async () => {
    const json = await withSnapshotReplay(dir, () => fetchJson<{ "@graph": unknown[] }>(url));
    expect(json["@graph"]).toHaveLength(1);
  });

  it("fails clearly for requests that were not recorded (never invents data)", async () => {
    await expect(withSnapshotReplay(dir, () => fetchJson("https://datos.example.org/otra.json"))).rejects.toThrow(/Sin copia guardada/);
    const body = "data=[out:json];node(1);out;";
    expect(snapshotKey("POST", url, body)).not.toBe(snapshotKey("POST", url, `${body} `));
  });
});
