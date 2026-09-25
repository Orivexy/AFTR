/**
 * Public URLs for stored media. Images are stored as pre-optimised WebP
 * variants (see src/server/media/image.ts); callers only deal with keys.
 */
export type ImageVariant = "sm" | "lg";

export const IMAGE_VARIANT_WIDTH: Record<ImageVariant, number> = { sm: 480, lg: 1280 };

export function imageUrl(key: string | null | undefined, variant: ImageVariant = "lg"): string | null {
  return key ? `/media/${key}_${variant}.webp` : null;
}

export function videoUrl(key: string): string {
  return `/media/${key}`;
}
