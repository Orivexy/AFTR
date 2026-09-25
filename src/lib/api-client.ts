/** Tiny typed fetch wrapper for the JSON API (client side). */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(0, "Sin conexión. Revisa tu red.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string; fields?: Record<string, string> } }).error;
    throw new ApiClientError(res.status, err?.message ?? "Algo ha fallado", err?.code, err?.fields);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body ?? {}),
  del: <T>(url: string) => request<T>("DELETE", url),
};

/** Revives ISO date strings in JSON API payloads for known date fields. */
export function reviveDates<T>(value: T): T {
  const DATE_KEYS = /^(startsAt|endsAt|createdAt|updatedAt|joinedAt)$/;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = DATE_KEYS.test(k) && typeof val === "string" ? new Date(val) : walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
