/**
 * Role helpers — the single place that decides what each role may do.
 * Commercial roles (ORGANIZER, VENUE) never imply staff permissions.
 */
export const ROLES = ["USER", "ORGANIZER", "VENUE", "MODERATOR", "ADMIN"] as const;
export type AppRole = (typeof ROLES)[number];

/** Moderators and admins. */
export function isStaff(role: AppRole | null | undefined): boolean {
  return role === "MODERATOR" || role === "ADMIN";
}

export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === "ADMIN";
}

/** Organizer / venue accounts (commercial features, never staff powers). */
export function isBusinessRole(role: AppRole | null | undefined): boolean {
  return role === "ORGANIZER" || role === "VENUE";
}

export const ROLE_LABEL: Record<AppRole, string> = {
  USER: "Usuario",
  ORGANIZER: "Organizador",
  VENUE: "Local",
  MODERATOR: "Moderador",
  ADMIN: "Admin",
};
