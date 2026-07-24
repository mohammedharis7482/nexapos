import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { categoryService } from "@/services/category.service";

import { CategoryDialog } from "./category-dialog";

vi.mock("@/services/category.service", () => ({
  categoryService: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const mockedService = vi.mocked(categoryService);

describe("CategoryDialog", () => {
  beforeEach(() => {
    mockedService.create.mockReset();
  });

  it("creates a category and refreshes the server-backed list", async () => {
    mockedService.create.mockResolvedValue({
      success: true,
      message: "Category created.",
      data: {
        id: "a2d6e62a-e2fa-455f-96bb-3a7fe471ed8a",
        name: "Dairy",
        description: "",
        display_order: 0,
        is_active: true,
        created_at: "",
        updated_at: "",
      },
    });
    const onSaved = vi.fn();
    render(
      <CategoryDialog
        open
        onOpenChange={vi.fn()}
        category={null}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "Dairy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(mockedService.create).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("displays backend field errors and a 403 message", async () => {
    mockedService.create.mockRejectedValue(
      new ApiError("Please check the entered details.", 403, {
        name: ["A category with this name already exists."],
      }),
    );
    render(
      <CategoryDialog
        open
        onOpenChange={vi.fn()}
        category={null}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "Dairy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));

    expect(await screen.findByText("Owner access is required.")).toBeInTheDocument();
    expect(
      screen.getByText("A category with this name already exists."),
    ).toBeInTheDocument();
  });
});
