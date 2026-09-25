/**
 * next/image loader for our pre-optimised variants: picks the smallest
 * stored variant that covers the requested width. Other URLs pass through.
 */
export default function mediaLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith("/media/") && /_(sm|lg)\.webp$/.test(src)) {
    const variant = width <= 480 ? "sm" : "lg";
    return `${src.replace(/_(sm|lg)\.webp$/, `_${variant}.webp`)}?w=${variant === "sm" ? 480 : 1280}`;
  }
  return src;
}
