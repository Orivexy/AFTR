"use client";

import { useCallback, useState } from "react";

export interface UploadedImage {
  kind: "image";
  id: string;
  key: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  url: string;
}

export interface UploadedVideo {
  kind: "video";
  id: string;
  key: string;
  posterKey: string | null;
  posterUrl: string | null;
  durationSec: number | null;
}

type Kind = "image" | "avatar" | "video";

const LIMITS_MB = { image: 12, avatar: 12, video: 80 };
const IMAGE_TYPES = /^image\/(jpeg|png|webp|avif|gif|heic|heif)$/;
const VIDEO_TYPES = /^video\/(mp4|quicktime|webm)$/;

/** Downscales big photos in the browser before upload (saves mobile data). */
async function shrinkImage(file: File, maxSide = 2048): Promise<Blob> {
  if (file.size < 1.5 * 1024 * 1024 || !/jpeg|png|webp/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function validateFile(file: File, kind: Kind): string | null {
  if (kind === "video" ? !VIDEO_TYPES.test(file.type) : !IMAGE_TYPES.test(file.type)) {
    return kind === "video" ? "Formato no soportado (MP4, MOV o WebM)" : "Formato no soportado (JPG, PNG, WebP)";
  }
  if (file.size > LIMITS_MB[kind] * 1024 * 1024) return `El archivo supera ${LIMITS_MB[kind]} MB`;
  return null;
}

/** Uploads one file to /api/uploads with progress reporting (XHR). */
export function useUpload() {
  const [progress, setProgress] = useState<number | null>(null);

  const upload = useCallback(async <T extends UploadedImage | UploadedVideo>(file: File, kind: Kind): Promise<T> => {
    const invalid = validateFile(file, kind);
    if (invalid) throw new Error(invalid);
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", kind === "video" ? file : await shrinkImage(file), file.name);
    setProgress(0);
    try {
      return await new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads");
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
          else reject(new Error(data?.error?.message ?? "No se pudo subir el archivo"));
        };
        xhr.onerror = () => reject(new Error("Sin conexión. Inténtalo de nuevo."));
        xhr.send(body);
      });
    } finally {
      setProgress(null);
    }
  }, []);

  return { upload, progress };
}
