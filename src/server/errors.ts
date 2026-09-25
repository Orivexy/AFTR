/** Framework-free error type so low-level modules (media, storage) stay reusable from scripts. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "Inicia sesión para continuar", "UNAUTHENTICATED");
export const forbidden = (msg = "No tienes permiso para hacer esto") => new ApiError(403, msg, "FORBIDDEN");
export const notFound = (msg = "No encontrado") => new ApiError(404, msg, "NOT_FOUND");
export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new ApiError(400, msg, "BAD_REQUEST", fields);
