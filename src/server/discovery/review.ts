import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { localToUtc, utcToLocalParts } from "@/lib/time";
import { applySourceUpdate, createEventFromNormalized, toComparable } from "./store";
import { createVenueFromNormalized } from "./engine";
import { DUPLICATE_THRESHOLD, scoreMatch } from "./dedupe";
import type { NormalizedEvent, NormalizedVenue } from "./types";

/** Staff actions on the discovery review queue: approve, reject, merge, edit, delete, verify. */

export interface RecordEdits {
  title?: string;
  date?: string; // local YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string | null;
  venueId?: string | null;
  locationName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  priceMin?: number | null; // cents
}

async function loadRecord(id: string) {
  const r = await db.sourceEventRecord.findUnique({ where: { id }, include: { source: { include: { city: { include: { country: true } } } } } });
  if (!r) throw notFound("Registro no encontrado");
  return r;
}

async function applyEdits(n: NormalizedEvent, edits: RecordEdits): Promise<NormalizedEvent> {
  const out = { ...n };
  if (edits.title) out.title = edits.title;
  if (edits.date || edits.startTime) {
    const cur = utcToLocalParts(new Date(n.startsAt), n.timezone);
    const start = localToUtc(edits.date ?? cur.date, edits.startTime ?? cur.time, n.timezone);
    out.startsAt = start.toISOString();
    out.timeUnknown = false;
    if (edits.endTime) {
      let end = localToUtc(edits.date ?? cur.date, edits.endTime, n.timezone);
      if (end <= start) end = new Date(end.getTime() + 24 * 3600_000);
      out.endsAt = end.toISOString();
    }
  }
  if (edits.venueId !== undefined) {
    if (edits.venueId) {
      const v = await db.venue.findUnique({ where: { id: edits.venueId }, select: { id: true, name: true, address: true, lat: true, lng: true } });
      if (!v) throw badRequest("Local no válido");
      Object.assign(out, { venueId: v.id, venueName: v.name, locationName: v.name, address: v.address, lat: v.lat, lng: v.lng });
    } else out.venueId = null;
  }
  if (edits.locationName) out.locationName = edits.locationName;
  if (edits.address) out.address = edits.address;
  if (edits.lat != null && edits.lng != null) Object.assign(out, { lat: edits.lat, lng: edits.lng });
  if (edits.priceMin !== undefined) out.priceMin = edits.priceMin;
  return out;
}

export async function approveRecord(id: string, reviewerId: string, edits: RecordEdits = {}) {
  const r = await loadRecord(id);
  if (r.eventId) throw badRequest("Este registro ya está vinculado a un evento");
  const n = await applyEdits(r.data as unknown as NormalizedEvent, edits);
  const city = { id: r.source.cityId, name: r.source.city.name, timezone: r.source.city.timezone, currency: r.source.city.country.currency };
  const event = await createEventFromNormalized(n, r.source, city);
  await db.sourceEventRecord.update({
    where: { id },
    data: { eventId: event.id, data: n as unknown as Prisma.InputJsonValue, reviewStatus: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() },
  });
  await linkPendingDuplicates(event.id, n, reviewerId);
  return event;
}

/** After approving, other queued copies of the same party are merged automatically. */
async function linkPendingDuplicates(eventId: string, n: NormalizedEvent, reviewerId: string) {
  const start = new Date(n.startsAt).getTime();
  const pending = await db.sourceEventRecord.findMany({ where: { reviewStatus: "PENDING", eventId: null }, take: 200 });
  for (const p of pending) {
    const other = p.data as unknown as NormalizedEvent;
    if (Math.abs(new Date(other.startsAt).getTime() - start) > 3 * 3600_000) continue;
    if (scoreMatch(toComparable(n), toComparable(other)).score >= DUPLICATE_THRESHOLD) {
      await db.sourceEventRecord.update({ where: { id: p.id }, data: { eventId, reviewStatus: "MERGED", reviewedById: reviewerId, reviewedAt: new Date() } });
    }
  }
}

export async function rejectRecord(id: string, reviewerId: string) {
  await loadRecord(id);
  await db.sourceEventRecord.update({ where: { id }, data: { reviewStatus: "REJECTED", reviewedById: reviewerId, reviewedAt: new Date() } });
}

export async function mergeRecord(id: string, eventId: string, reviewerId: string) {
  const r = await loadRecord(id);
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw notFound("Evento no encontrado");
  await applySourceUpdate(eventId, r.data as unknown as NormalizedEvent, r.source, r.source.city.name);
  await db.sourceEventRecord.update({ where: { id }, data: { eventId, reviewStatus: "MERGED", duplicateOfId: null, reviewedById: reviewerId, reviewedAt: new Date() } });
}

/** Forget a record (it may be queued again on the next sync; use reject to block it). */
export async function deleteRecord(id: string) {
  await db.sourceEventRecord.delete({ where: { id } });
}

export async function markEventVerified(eventId: string, verified: boolean) {
  const e = await db.event.findUnique({ where: { id: eventId }, select: { trust: true, source: true } });
  if (!e) throw notFound("Evento no encontrado");
  const next = verified ? "VERIFIED" : e.source === "IMPORT" ? "IMPORTED" : e.source === "VENUE" ? "OFFICIAL" : "COMMUNITY";
  if (next === e.trust) return;
  await db.$transaction([
    db.event.update({ where: { id: eventId }, data: { trust: next } }),
    db.eventChange.create({ data: { eventId, field: "trust", oldValue: e.trust, newValue: next } }),
  ]);
}

// ─── Venue records ───────────────────────────────────────────────────────────

export async function approveVenueRecord(id: string, edits: { lat?: number; lng?: number; address?: string } = {}) {
  const r = await db.sourceVenueRecord.findUnique({ where: { id }, include: { source: true } });
  if (!r) throw notFound("Registro no encontrado");
  if (r.venueId) throw badRequest("Ya está vinculado a un local");
  const n = { ...(r.data as unknown as NormalizedVenue), ...edits };
  const venue = await createVenueFromNormalized(n, r.source.cityId, r.source.trust === "OFFICIAL" ? "OFFICIAL" : "IMPORTED");
  await db.sourceVenueRecord.update({ where: { id }, data: { venueId: venue.id, reviewStatus: "APPROVED" } });
  return venue;
}

export async function mergeVenueRecord(id: string, venueId: string) {
  const v = await db.venue.findUnique({ where: { id: venueId }, select: { id: true } });
  if (!v) throw notFound("Local no encontrado");
  await db.sourceVenueRecord.update({ where: { id }, data: { venueId, reviewStatus: "MERGED" } });
}

export async function setVenueRecordStatus(id: string, action: "reject" | "delete") {
  if (action === "delete") await db.sourceVenueRecord.delete({ where: { id } });
  else await db.sourceVenueRecord.update({ where: { id }, data: { reviewStatus: "REJECTED" } });
}
