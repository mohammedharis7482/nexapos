"use client";

import { PackageSearch } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder tints are drawn from the brand scale only.
 *
 * success/warning/danger already carry stock-status meaning on these same
 * surfaces (the billing grid's stock badge, inventory status), so reusing
 * them for category identity would read as a status signal. The brand scale
 * keeps the placeholder quiet and unambiguous, matching the design system's
 * "restrained professional blue" and "quiet semantic colours" direction.
 */
const PLACEHOLDER_TINTS = [
  "bg-brand-50 text-brand-600",
  "bg-brand-100 text-brand-700",
  "bg-surface-subtle text-brand-500",
  "bg-brand-50 text-brand-800",
] as const;

/** Stable per-category tint so a product keeps the same placeholder colour
 * across renders, pages, and sessions. Uncategorised products share the
 * first tint. */
export function categoryTint(categoryName?: string | null): string {
  if (!categoryName) return PLACEHOLDER_TINTS[0];
  let hash = 0;
  for (let index = 0; index < categoryName.length; index += 1) {
    hash = (hash * 31 + categoryName.charCodeAt(index)) >>> 0;
  }
  return PLACEHOLDER_TINTS[hash % PLACEHOLDER_TINTS.length];
}

const SIZES = {
  sm: { box: "size-10", icon: "size-4" },
  md: { box: "size-14", icon: "size-5" },
  xl: { box: "size-20", icon: "size-7" },
  lg: { box: "size-full", icon: "size-7" },
} as const;

/**
 * Product image with a category-tinted fallback.
 *
 * Renders the placeholder both when there is no image and when an image URL
 * fails to load, so a stale or unreachable file can never surface a broken
 * image icon.
 */
export function ProductThumb({
  src,
  alt,
  categoryName,
  size = "md",
  className,
}: {
  src?: string | null;
  alt: string;
  categoryName?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dimensions = SIZES[size];
  // Remembering *which* src failed rather than a boolean means a new src is
  // automatically a fresh chance to load, with no reset effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src) && failedSrc === src;

  const shared = cn(
    "shrink-0 overflow-hidden rounded-[var(--radius-md)]",
    dimensions.box,
    className,
  );

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        data-testid="product-thumb-placeholder"
        className={cn(shared, "flex items-center justify-center", categoryTint(categoryName))}
      >
        <PackageSearch className={dimensions.icon} />
      </div>
    );
  }

  return (
    <div className={cn(shared, "bg-surface-subtle")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- media is served
          from the configurable storage backend (local in development, a cloud
          host later), so the origin is not known at build time and cannot be
          declared in next.config images.remotePatterns. */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
