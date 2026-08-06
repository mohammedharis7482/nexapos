import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_IMAGE_BYTES } from "@/lib/image-resize";

import { ProductImageField } from "./product-image-field";

// resizeImage needs a real browser decoder; the picker's contract is that it
// hands back whatever resizeImage returns, so stub it to the identity.
vi.mock("@/lib/image-resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image-resize")>()),
  resizeImage: vi.fn(async (file: File) => file),
}));

function imageFile(name: string, type: string, bytes = 32) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function renderField(overrides: Partial<Parameters<typeof ProductImageField>[0]> = {}) {
  const onFileChange = vi.fn();
  const onRemoveExisting = vi.fn();
  render(
    <ProductImageField
      existingUrl={null}
      productName="Bananas"
      file={null}
      onFileChange={onFileChange}
      onRemoveExisting={onRemoveExisting}
      {...overrides}
    />,
  );
  return { onFileChange, onRemoveExisting };
}

describe("ProductImageField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no object-URL support for File blobs.
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("renders an optional, empty drop zone by default", () => {
    renderField();
    expect(screen.getByText("Drop an image here or browse")).toBeInTheDocument();
    expect(screen.getByText(/optional/)).toBeInTheDocument();
  });

  it("accepts a browsed file", async () => {
    const { onFileChange } = renderField();
    const file = imageFile("bananas.jpg", "image/jpeg");
    fireEvent.change(screen.getByLabelText("Product image"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(onFileChange).toHaveBeenCalledWith(file));
  });

  it("accepts a dropped file", async () => {
    const { onFileChange } = renderField();
    const file = imageFile("bananas.png", "image/png");
    const zone = screen.getByText("Drop an image here or browse").closest("label")!;
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(onFileChange).toHaveBeenCalledWith(file));
  });

  it("rejects a file whose type the server would reject", async () => {
    const { onFileChange } = renderField();
    fireEvent.change(screen.getByLabelText("Product image"), {
      target: { files: [imageFile("clip.gif", "image/gif")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Upload a JPG, PNG, or WEBP image.",
    );
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("rejects a file over the 5 MB ceiling and names the actual size", async () => {
    const { onFileChange } = renderField();
    fireEvent.change(screen.getByLabelText("Product image"), {
      target: { files: [imageFile("huge.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1)] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Images must be 5 MB or smaller");
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("shows a saved image and clears it on Remove", () => {
    const { onFileChange, onRemoveExisting } = renderField({
      existingUrl: "http://localhost/media/product-images/1.jpg",
    });
    expect(screen.getByRole("img", { name: "Bananas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onFileChange).toHaveBeenCalledWith(null);
    expect(onRemoveExisting).toHaveBeenCalled();
  });

  it("surfaces an upload failure passed down from the form", () => {
    renderField({ error: "The image could not be uploaded. The product was saved." });
    expect(screen.getByRole("alert")).toHaveTextContent("The image could not be uploaded.");
  });

  it("disables the controls while an upload is in flight", () => {
    renderField({ existingUrl: "http://localhost/media/1.jpg", uploading: true });
    expect(screen.getByText("Uploading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByLabelText("Replace product image")).toBeDisabled();
  });
});
