import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Records an administrative or commercial operation. Never throws. */
export async function audit(entry: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
        ipAddress: entry.ip?.slice(0, 64),
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}
