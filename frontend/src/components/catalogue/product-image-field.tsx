"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductThumb } from "@/components/ui/product-thumb";
import {
  ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  formatBytes,
  isAcceptedImageType,
  resizeImage,
} from "@/lib/image-resize";
import { cn } from "@/lib/utils";

/**
 * Optional product image picker.
 *
 * Selection only - the file is uploaded by the parent after the product is
 * saved, because a new product has no id to upload against until then. The
 * form works identically whether or not a file is chosen.
 *
 * Layout mirrors the CSV import control (selected-file card with Replace /
 * Remove actions, sr-only input inside a styled label) so uploads look the
 * same everywhere in the app.
 */
export function ProductImageField({
  existingUrl,
  categoryName,
  productName,
  file,
  onFileChange,
  onRemoveExisting,
  disabled,
  uploading,
  error,
}: {
  existingUrl: string | null;
  categoryName?: string | null;
  productName: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onRemoveExisting: () => void;
  disabled?: boolean;
  uploading?: boolean;
  error?: string | null;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  const busy = Boolean(disabled || uploading || preparing);
  const shownError = error ?? localError;

  const accept = (candidate: File | null | undefined) => {
    setLocalError(null);
    if (!candidate) return;
    if (!isAcceptedImageType(candidate)) {
      setLocalError("Upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      setLocalError(
        `Images must be 5 MB or smaller. That file is ${formatBytes(candidate.size)}.`,
      );
      return;
    }
    setPreparing(true);
    void resizeImage(candidate)
      .then((prepared) => {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(prepared);
        previewUrlRef.current = url;
        setPreview(url);
        onFileChange(prepared);
      })
      .finally(() => setPreparing(false));
  };

  const clear = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    setLocalError(null);
    onFileChange(null);
    if (existingUrl) onRemoveExisting();
  };

  const shownImage = preview ?? existingUrl;

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold">Product image</span>

      {shownImage ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-surface-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb
              src={shownImage}
              alt={productName || "Product image"}
              categoryName={categoryName}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {file ? file.name : "Current image"}
              </p>
              <p className="mt-0.5 text-sm text-foreground-muted">
                {preparing
                  ? "Preparing…"
                  : uploading
                    ? "Uploading…"
                    : file
                      ? formatBytes(file.size)
                      : "Saved"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label
              className={cn(
                "inline-flex min-h-[var(--control-md)] cursor-pointer items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-hover",
                busy && "pointer-events-none opacity-60",
              )}
            >
              Replace Image
              <input
                className="sr-only"
                aria-label="Replace product image"
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                disabled={busy}
                onChange={(event) => accept(event.target.files?.[0])}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              leadingIcon={<Trash2 className="size-4" />}
              onClick={clear}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) accept(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-dashed px-4 py-6 text-center transition-colors",
            dragging
              ? "border-primary bg-primary-soft/40"
              : "border-border bg-surface-subtle hover:bg-surface-hover",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus className="size-5 text-text-muted" aria-hidden="true" />
          <span className="text-sm font-semibold">
            {preparing ? "Preparing image…" : "Drop an image here or browse"}
          </span>
          <span className="text-xs text-text-muted">
            JPG, PNG, or WEBP · up to 5 MB · optional
          </span>
          <input
            id={inputId}
            className="sr-only"
            aria-label="Product image"
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            disabled={busy}
            onChange={(event) => accept(event.target.files?.[0])}
          />
        </label>
      )}

      {shownError ? (
        <p role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
