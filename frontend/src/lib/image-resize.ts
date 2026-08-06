/**
 * Client-side image downscale + recompress before upload.
 *
 * Keeps uploads fast on shop wifi rather than relying only on the server's
 * 5 MB ceiling: a modern phone photo is often 4-8 MB and would either be
 * rejected or spend a long time uploading at full resolution. Product
 * thumbnails are never displayed larger than a card, so full resolution has
 * no benefit.
 *
 * Server-side validation remains authoritative - this is a convenience and a
 * bandwidth optimisation, never a security control.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

const MAX_EDGE = 1024;
const QUALITY = 0.85;

/**
 * Decoding is bounded so a file the browser will neither load nor error on
 * cannot leave the picker stuck with no feedback - the caller falls back to
 * uploading the original file instead.
 */
export const IMAGE_DECODE_TIMEOUT_MS = 10_000;

export function isAcceptedImageType(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** Human-readable size for feedback text, matching the CSV import wording. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      action();
    };
    const timer = window.setTimeout(
      () => finish(() => reject(new Error("The image took too long to read."))),
      IMAGE_DECODE_TIMEOUT_MS,
    );
    const image = new Image();
    image.onload = () => finish(() => resolve(image));
    image.onerror = () => finish(() => reject(new Error("The image could not be read.")));
    image.src = url;
  });
}

/**
 * Returns a downscaled JPEG/PNG copy, or the original file when resizing is
 * unnecessary or unavailable (no canvas support, decode failure). Callers
 * always get a usable File.
 */
export async function resizeImage(file: File): Promise<File> {
  if (!isAcceptedImageType(file)) return file;
  if (typeof document === "undefined") return file;

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return file;
  }

  const largestEdge = Math.max(image.width, image.height);
  // Already small enough and already modest in bytes: leave it alone so we
  // don't recompress (and degrade) an image needlessly.
  if (largestEdge <= MAX_EDGE && file.size <= 1024 * 1024) return file;

  const scale = Math.min(1, MAX_EDGE / largestEdge);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, width, height);

  // Preserve PNG for images that may rely on transparency; everything else
  // recompresses to JPEG, which is materially smaller for photographs.
  const targetType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, targetType, QUALITY);
  });
  if (!blob || blob.size >= file.size) return file;

  const extension = targetType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^./\\]+$/, "") || "product-image";
  return new File([blob], `${baseName}.${extension}`, { type: targetType });
}
