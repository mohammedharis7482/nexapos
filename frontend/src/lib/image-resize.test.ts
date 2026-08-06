import { describe, expect, it, vi } from "vitest";

import {
  ACCEPT_ATTRIBUTE,
  IMAGE_DECODE_TIMEOUT_MS,
  MAX_IMAGE_BYTES,
  formatBytes,
  isAcceptedImageType,
  resizeImage,
} from "./image-resize";

function fakeFile(name: string, type: string, bytes = 10) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("image-resize limits", () => {
  it("mirrors the server's 5 MB ceiling", () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("accepts only the formats the server accepts", () => {
    expect(ACCEPT_ATTRIBUTE).toBe("image/jpeg,image/png,image/webp");
    expect(isAcceptedImageType(fakeFile("a.jpg", "image/jpeg"))).toBe(true);
    expect(isAcceptedImageType(fakeFile("a.png", "image/png"))).toBe(true);
    expect(isAcceptedImageType(fakeFile("a.webp", "image/webp"))).toBe(true);
    expect(isAcceptedImageType(fakeFile("a.gif", "image/gif"))).toBe(false);
    // A GIF renamed to .jpg still reports its real type here, and the server
    // re-checks the decoded format regardless.
    expect(isAcceptedImageType(fakeFile("sneaky.jpg", "image/gif"))).toBe(false);
  });
});

describe("formatBytes", () => {
  it("scales from bytes to megabytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(6 * 1024 * 1024)).toBe("6.0 MB");
  });
});

describe("resizeImage", () => {
  it("returns the original file for a type it will not process", async () => {
    const file = fakeFile("a.gif", "image/gif");
    await expect(resizeImage(file)).resolves.toBe(file);
  });

  it("falls back to the original file when decoding never settles", async () => {
    // jsdom fires neither load nor error for a blob URL, which is exactly the
    // stuck case the decode timeout exists for: the caller must still get a
    // File back so the picker never hangs with no feedback.
    vi.useFakeTimers();
    try {
      const file = fakeFile("a.jpg", "image/jpeg");
      const pending = resizeImage(file);
      await vi.advanceTimersByTimeAsync(IMAGE_DECODE_TIMEOUT_MS + 1);
      await expect(pending).resolves.toBe(file);
    } finally {
      vi.useRealTimers();
    }
  });
});
