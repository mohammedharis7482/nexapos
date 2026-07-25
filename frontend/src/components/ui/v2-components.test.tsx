import { fireEvent, render, screen } from "@testing-library/react";
import { Boxes } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/display";
import { CardSkeleton, EmptyState } from "@/components/ui/feedback";
import { Checkbox, FormField, Input, SegmentedControl, Select } from "@/components/ui/input";
import { FilterToolbar, MobileDataCard, Pagination, ResponsiveGrid } from "@/components/ui/layout";
import { Drawer } from "@/components/ui/overlay";
import { PaymentMethodBadge, RoleBadge, StockStatusBadgeV2 } from "@/components/ui/status";
import { DataTable, DataTableBody, DataTableCell, DataTableHeader, DataTableHeading, DataTableRow, ResponsiveDataList } from "@/components/ui/table";

describe("V2 components", () => {
  it("keeps loading-button width content in the accessibility tree", () => {
    render(<Button loading leadingIcon={<Boxes />}>Save product</Button>);
    expect(screen.getByRole("button", { name: "Save product" })).toHaveAttribute("aria-busy", "true");
  });

  it("associates field hints and errors with controls", () => {
    render(<><FormField label="Name" htmlFor="name" hint="Customer-facing name"><Input id="name" /></FormField><FormField label="SKU" htmlFor="sku" error="SKU is required"><Input id="sku" /></FormField></>);
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Customer-facing name");
    expect(screen.getByLabelText("SKU")).toHaveAccessibleDescription("SKU is required");
    expect(screen.getByLabelText("SKU")).toHaveAttribute("aria-invalid", "true");
  });

  it("supports accessible checkbox and segmented selection", () => {
    const change = vi.fn();
    render(<><Checkbox label="Active product" description="Available for billing." /><SegmentedControl label="Tender" value="cash" onChange={change} options={[{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }]} /></>);
    expect(screen.getByRole("checkbox", { name: "Active product" })).toHaveAccessibleDescription("Available for billing.");
    expect(screen.getByRole("button", { name: "Cash" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Card" }));
    expect(change).toHaveBeenCalledWith("card");
  });

  it("renders a controlled native select with reserved indicator space", () => {
    const change = vi.fn();
    render(
      <Select aria-label="Category" defaultValue="" onChange={change}>
        <option value="">All categories</option>
        <option value="dairy">Dairy</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Category" });
    expect(select).toHaveClass("appearance-none", "pr-11");
    expect(select.parentElement).toHaveAttribute("data-slot", "select-control");
    expect(select.parentElement?.querySelector('[data-slot="select-indicator"]')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "dairy" } });
    expect(change).toHaveBeenCalledOnce();
  });

  it("keeps filter results and pagination actions in connected surfaces", () => {
    const previous = vi.fn();
    const next = vi.fn();
    render(
      <>
        <FilterToolbar result="12 matching products" status={<span>Filters applied</span>}>
          <Input aria-label="Search products" />
        </FilterToolbar>
        <Pagination count={12} noun="product" page={2} hasNext onPrevious={previous} onNext={next} />
      </>,
    );
    expect(screen.getByText("12 matching products")).toBeInTheDocument();
    expect(screen.getByText("Filters applied")).toBeInTheDocument();
    expect(screen.getByLabelText("product pagination")).toHaveTextContent("12 products · Page 2");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it("renders metric values without truncation and semantic status labels", () => {
    render(<><MetricCard label="Sales" value="QAR 843.50" icon={Boxes} /><StockStatusBadgeV2 status="LOW_STOCK" /><PaymentMethodBadge method="CASH" /><RoleBadge role="OWNER" /></>);
    expect(screen.getByText("QAR 843.50")).not.toHaveClass("truncate");
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("renders semantic desktop tables and a separate mobile card structure", () => {
    render(<ResponsiveDataList table={<DataTable><DataTableHeader><DataTableRow><DataTableHeading>Product</DataTableHeading></DataTableRow></DataTableHeader><DataTableBody><DataTableRow><DataTableCell>Milk</DataTableCell></DataTableRow></DataTableBody></DataTable>} cards={<MobileDataCard>Milk card</MobileDataCard>} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByText("Milk card")).toBeInTheDocument();
  });

  it("provides responsive layout, loading, empty, and drawer foundations", () => {
    const close = vi.fn();
    render(<><ResponsiveGrid data-testid="grid"><div>One</div><div>Two</div></ResponsiveGrid><CardSkeleton /><EmptyState title="No products" description="Add the first product." secondaryAction={<Button>Learn more</Button>} action={<Button>Add product</Button>} /><Drawer open onOpenChange={close} title="Inventory drawer">Drawer content</Drawer></>);
    expect(screen.getByTestId("grid")).toHaveClass("grid");
    expect(screen.getByLabelText("Loading card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add product" })).toBeInTheDocument();
    const drawer = screen.getByRole("dialog", { name: "Inventory drawer" });
    fireEvent(drawer, new Event("cancel"));
    expect(close).toHaveBeenCalledWith(false);
  });
});
