import { route, badRequest } from "@/server/http";
import { env } from "@/server/env";
import { handleUpload, type UploadKind } from "@/server/services/uploads";

export const runtime = "nodejs";
export const maxDuration = 120;

const KINDS = new Set<UploadKind>(["image", "avatar", "video"]);

export const POST = route({ auth: true, rateLimit: "upload" }, async ({ req, user }) => {
  // Reject oversized bodies before buffering them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  const maxBytes = Math.max(env.MAX_IMAGE_MB, env.MAX_VIDEO_MB) * 1024 * 1024 + 64 * 1024;
  if (declared > maxBytes) throw badRequest("Archivo demasiado grande");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Subida no válida");
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "image") as UploadKind;
  if (!(file instanceof File) || file.size === 0) throw badRequest("Selecciona un archivo");
  if (!KINDS.has(kind)) throw badRequest("Tipo de subida no válido");
  return handleUpload(user!.id, file, kind);
});
