import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { billingService } from "@/services/billing.service";
import { categoryService } from "@/services/category.service";
import { inventoryService } from "@/services/inventory.service";
import { shiftService } from "@/services/shift.service";
import type { DraftSale } from "@/types/billing";
import type { InventoryItem } from "@/types/inventory";

import BillingPage, {
  availableForDraft,
  billingWorkspaceState,
} from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/services/billing.service", () => ({
  billingService: {
    create: vi.fn(),
    detail: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    setDiscount: vi.fn(),
    cancel: vi.fn(),
    list: vi.fn(),
    hold: vi.fn(),
    resume: vi.fn(),
  },
}));
vi.mock("@/services/category.service", () => ({
  categoryService: { list: vi.fn() },
}));
vi.mock("@/services/inventory.service", () => ({
  inventoryService: { list: vi.fn() },
}));
vi.mock("@/services/shift.service", () => ({
  shiftService: { current: vi.fn() },
}));

const draft: DraftSale = {
  id: "draft-id",
  status: "DRAFT",
  currency: "QAR",
  created_by: { id: "user-id", full_name: "Cashier", role: "CASHIER" },
  items: [],
  subtotal: "12.00",
  tax_total: "0.60",
  discount_type: "NONE",
  discount_value: "0.00",
  discount_total: "0.00",
  grand_total: "12.60",
  notes: "",
  cancelled_at: null,
  cancelled_by: null,
  created_at: "",
  updated_at: "",
  held_at: null,
  shift: null,
};
const inventoryItem: InventoryItem = {
  product: {
    secondary_name: "",
    id: "product-id",
    name: "Baladna Milk",
    sku: "MILK-001",
    barcode: "6281007023412",
    unit: "BOTTLE", image_url: null,
    selling_price: "6.00",
    category: null,
    is_active: true,
    pricing_mode: "STANDARD",
    packets: [],
  },
  quantity_on_hand: "10.000",
  low_stock_threshold: "2.000",
  stock_status: "IN_STOCK",
  last_movement_at: null,
  is_initialized: true,
};

const billing = vi.mocked(billingService);
const categories = vi.mocked(categoryService);
const inventory = vi.mocked(inventoryService);
const shifts = vi.mocked(shiftService);

describe("BillingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    billing.create.mockResolvedValue({ success: true, message: "", data: draft });
    billing.detail.mockResolvedValue({ success: true, message: "", data: draft });
    billing.addItem.mockResolvedValue({ success: true, message: "", data: draft });
    billing.cancel.mockResolvedValue({ success: true, message: "", data: { ...draft, status: "CANCELLED" } });
    billing.list.mockResolvedValue({
      success: true, message: "",
      data: { count: 0, next: null, previous: null, results: [] },
    });
    shifts.current.mockResolvedValue({
      success: true, message: "", data: {
        id: "shift-id", status: "OPEN", cashier: draft.created_by,
        opened_at: "", closed_at: null, opening_cash: "0.00",
        expected_closing_cash: "0.00", counted_closing_cash: null,
        cash_difference: null, opening_note: "", closing_note: "",
        summary: {
          opening_cash: "0.00", completed_bills: 0, gross_sales: "0.00",
          cash_sales: "0.00", card_sales: "0.00", split_payment_count: 0,
          expected_closing_cash: "0.00", counted_closing_cash: null,
          cash_difference: null, items_sold: "0.000", opened_at: "", closed_at: null,
        },
      },
    });
    categories.list.mockResolvedValue({
      success: true,
      message: "",
      data: { count: 0, next: null, previous: null, results: [] },
    });
    inventory.list.mockResolvedValue({
      success: true,
      message: "",
      data: { count: 1, next: null, previous: null, results: [inventoryItem] },
    });
  });

  it("covers loading, empty, error, and ready states", () => {
    expect(billingWorkspaceState(true, null, null)).toBe("loading");
    expect(billingWorkspaceState(false, null, "Failed")).toBe("error");
    expect(billingWorkspaceState(false, null, null)).toBe("empty");
    expect(billingWorkspaceState(false, draft, null)).toBe("ready");
    expect(availableForDraft(inventoryItem)).toBe(true);
    expect(availableForDraft({ ...inventoryItem, stock_status: "OUT_OF_STOCK", quantity_on_hand: "0.000" })).toBe(false);
  });

  it("reloads a saved draft and renders API totals and empty cart", async () => {
    localStorage.setItem("nexapos.activeDraftId", "draft-id");
    render(<BillingPage />);
    expect(await screen.findByText("Cart is empty")).toBeInTheDocument();
    expect(billing.detail).toHaveBeenCalledWith("draft-id");
    expect(screen.getAllByText("QAR 12.60")).not.toHaveLength(0);
    expect(billing.create).not.toHaveBeenCalled();
  });

  it("shows a stable shift-required panel without creating a draft or redirect loop", async () => {
    shifts.current.mockResolvedValue({ success: true, message: "", data: null });
    render(<BillingPage />);
    expect(await screen.findByRole("heading", { name: "Open a shift to start billing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Shift" })).toHaveAttribute("href", "/sales/shifts/current");
    expect(billing.create).not.toHaveBeenCalled();
    expect(shifts.current).toHaveBeenCalledTimes(1);
  });

  it("adds an exact barcode match on Enter", async () => {
    render(<BillingPage />);
    const search = await screen.findByLabelText("Product or barcode search");
    fireEvent.change(search, { target: { value: "6281007023412" } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() =>
      expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
        product_id: "product-id",
        quantity: "1.000",
      }),
    );
  });

  it("does not double-search when Enter is pressed before the debounce timer fires", async () => {
    render(<BillingPage />);
    const search = await screen.findByLabelText("Product or barcode search");
    fireEvent.change(search, { target: { value: "6281007023412" } });
    fireEvent.submit(search.closest("form")!);
    await waitFor(() => expect(billing.addItem).toHaveBeenCalled());
    // Wait past the 250ms debounce window the pending timer from the
    // keystroke would have fired in, if it hadn't been cancelled - a
    // second search for the *same* term here means the timer wasn't
    // actually cancelled by the immediate Enter-triggered search.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const callsForBarcode = inventory.list.mock.calls.filter(
      ([params]) => params?.search === "6281007023412",
    );
    expect(callsForBarcode).toHaveLength(1);
  });

  it("does not add the same scanned product twice from a double Enter before the add resolves", async () => {
    let resolveAdd: (value: { success: true; message: string; data: DraftSale }) => void;
    billing.addItem.mockReturnValue(
      new Promise((resolve) => { resolveAdd = resolve; }),
    );
    render(<BillingPage />);
    const search = await screen.findByLabelText("Product or barcode search");
    const form = search.closest("form")!;
    fireEvent.change(search, { target: { value: "6281007023412" } });
    fireEvent.submit(form);
    await waitFor(() => expect(billing.addItem).toHaveBeenCalledTimes(1));
    // A second Enter (or scan) while the first add is still in flight must
    // not fire a second addItem call for the same product.
    fireEvent.submit(form);
    // Give the second submit's async chain (searchProducts -> addProduct)
    // room to actually run before asserting - otherwise this check can
    // pass vacuously before the second call would have landed.
    await new Promise((resolve) => setTimeout(resolve, 50));
    resolveAdd!({ success: true, message: "", data: draft });
    await waitFor(() => expect(billing.addItem).toHaveBeenCalledTimes(1));
  });

  it("confirms cancellation and prepares a fresh draft", async () => {
    billing.create
      .mockResolvedValueOnce({ success: true, message: "", data: draft })
      .mockResolvedValueOnce({
        success: true,
        message: "",
        data: { ...draft, id: "fresh-id" },
      });
    render(<BillingPage />);
    await screen.findByText("Cart is empty");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Cancel this draft?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    await waitFor(() => expect(billing.cancel).toHaveBeenCalledWith("draft-id"));
    expect(localStorage.getItem("nexapos.activeDraftId")).toBe("fresh-id");
  });

  // Multi-pricing products need a mode chosen before they can be added, so
  // the card opens an inline panel *above* the grid instead of adding
  // straight away. The panel deliberately lives outside the grid: the grid's
  // arrow-key navigation resolves cards by indexing its `button` elements, so
  // a segmented control inside a card would shift every index.
  describe("multi-pricing products", () => {
    const multiItem: InventoryItem = {
      ...inventoryItem,
      product: {
        ...inventoryItem.product,
        id: "rice-id",
        name: "Basmati Rice",
        sku: "RICE-001",
        barcode: "6291001",
        unit: "KG",
        selling_price: "12.00",
        pricing_mode: "MULTI",
        packets: [
          { id: "p250", size: "0.250", price: "3.50", display_order: 0, is_active: true },
          { id: "p1000", size: "1.000", price: "13.00", display_order: 1, is_active: true },
        ],
      },
      quantity_on_hand: "5.000",
    };

    function withProducts(results: InventoryItem[]) {
      inventory.list.mockResolvedValue({
        success: true, message: "",
        data: { count: results.length, next: null, previous: null, results },
      });
    }

    it("opens the pricing panel instead of adding a multi-pricing product on click", async () => {
      withProducts([multiItem]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Basmati Rice/ }));
      expect(
        await screen.findByRole("group", { name: /Choose how to sell Basmati Rice/ }),
      ).toBeInTheDocument();
      expect(billing.addItem).not.toHaveBeenCalled();
    });

    it("sends the chosen packet to the API", async () => {
      withProducts([multiItem]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Basmati Rice/ }));
      await screen.findByRole("group", { name: /Choose how to sell/ });
      fireEvent.click(screen.getByRole("button", { name: /1 kg/ }));
      fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
      await waitFor(() =>
        expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
          product_id: "rice-id",
          quantity: "1",
          pricing_mode: "PACKET",
          packet_id: "p1000",
        }),
      );
    });

    it("sends a loose weight to the API", async () => {
      withProducts([multiItem]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Basmati Rice/ }));
      await screen.findByRole("group", { name: /Choose how to sell/ });
      fireEvent.click(screen.getByRole("button", { name: "Loose" }));
      fireEvent.change(screen.getByLabelText("Weight in kg"), { target: { value: "0.750" } });
      fireEvent.click(screen.getByRole("button", { name: "Add to Bill" }));
      await waitFor(() =>
        expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
          product_id: "rice-id",
          quantity: "0.750",
          pricing_mode: "LOOSE",
          packet_id: undefined,
        }),
      );
    });

    it("still adds a standard product in one click, with no pricing fields", async () => {
      withProducts([inventoryItem, multiItem]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Baladna Milk/ }));
      await waitFor(() =>
        expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
          product_id: "product-id",
          quantity: "1.000",
        }),
      );
      expect(screen.queryByRole("group", { name: /Choose how to sell/ })).toBeNull();
    });

    it("does not silently add a scanned multi-pricing product", async () => {
      withProducts([multiItem]);
      render(<BillingPage />);
      const search = await screen.findByLabelText("Product or barcode search");
      fireEvent.change(search, { target: { value: "6291001" } });
      fireEvent.submit(search.closest("form")!);
      expect(
        await screen.findByRole("group", { name: /Choose how to sell/ }),
      ).toBeInTheDocument();
      expect(billing.addItem).not.toHaveBeenCalled();
    });

    it("closes the panel on Cancel without adding anything", async () => {
      withProducts([multiItem]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Basmati Rice/ }));
      await screen.findByRole("group", { name: /Choose how to sell/ });
      // Scoped to the panel: the page has its own "Cancel" (cancel draft).
      const panel = screen.getByRole("group", { name: /Choose how to sell/ });
      fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        expect(screen.queryByRole("group", { name: /Choose how to sell/ })).toBeNull(),
      );
      expect(billing.addItem).not.toHaveBeenCalled();
    });

    it("keeps arrow-key grid navigation intact with the panel open", async () => {
      // The regression this whole layout decision exists to prevent: the
      // panel's own buttons must never join the grid's button list.
      const second: InventoryItem = {
        ...multiItem,
        product: { ...multiItem.product, id: "sugar-id", name: "Sugar", sku: "SUGAR-1" },
      };
      const third: InventoryItem = {
        ...inventoryItem,
        product: { ...inventoryItem.product, id: "salt-id", name: "Salt", sku: "SALT-1" },
      };
      withProducts([multiItem, second, third]);
      render(<BillingPage />);
      const grid = (await screen.findByRole("button", { name: /Basmati Rice/ }))
        .parentElement!;

      const before = Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
      expect(before).toHaveLength(3);

      fireEvent.click(before[0]);
      await screen.findByRole("group", { name: /Choose how to sell/ });

      // Same grid, same three cards - the panel added buttons to the page but
      // none of them to the grid.
      const after = Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
      expect(after).toHaveLength(3);
      expect(after.map((card) => card.textContent)).toEqual([
        expect.stringContaining("Basmati Rice"),
        expect.stringContaining("Sugar"),
        expect.stringContaining("Salt"),
      ]);

      after[0].focus();
      fireEvent.keyDown(after[0], { key: "ArrowRight" });
      expect(after[1]).toHaveFocus();
      fireEvent.keyDown(after[1], { key: "ArrowRight" });
      expect(after[2]).toHaveFocus();
      fireEvent.keyDown(after[2], { key: "ArrowLeft" });
      expect(after[1]).toHaveFocus();
    });

    it("keeps the F-key shortcuts working while the panel is open", async () => {
      withProducts([multiItem]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Basmati Rice/ }));
      await screen.findByRole("group", { name: /Choose how to sell/ });
      fireEvent.keyDown(document, { key: "F4" });
      expect(await screen.findByText("Cancel this draft?")).toBeInTheDocument();
    });
  });

  // Second-language names add text to the cards. The grid's arrow-key
  // navigation resolves cards by indexing its `button` elements, so this
  // re-checks that invariant now that cards render more than before, and
  // pins the RTL scope boundary: `dir` belongs on the secondary-name element
  // and nowhere else.
  describe("secondary product names", () => {
    const named = (index: number, secondary: string): InventoryItem => ({
      ...inventoryItem,
      product: {
        ...inventoryItem.product,
        id: `product-${index}`,
        name: `Product ${index}`,
        secondary_name: secondary,
        sku: `SKU-${index}`,
        barcode: `barcode-${index}`,
      },
    });

    function withProducts(results: InventoryItem[]) {
      inventory.list.mockResolvedValue({
        success: true, message: "",
        data: { count: results.length, next: null, previous: null, results },
      });
    }

    it("shows the second name on a card that has one", async () => {
      withProducts([named(0, "أرز بسمتي")]);
      render(<BillingPage />);
      expect(await screen.findByText("أرز بسمتي")).toBeInTheDocument();
    });

    it("renders a card without a second name exactly as before", async () => {
      withProducts([named(0, "")]);
      render(<BillingPage />);
      const card = await screen.findByRole("button", { name: /Product 0/ });
      expect(card.querySelectorAll("[dir]")).toHaveLength(0);
    });

    it("puts dir only on the secondary-name element, not the card or grid", async () => {
      withProducts([named(0, "أرز بسمتي")]);
      render(<BillingPage />);
      const card = await screen.findByRole("button", { name: /Product 0/ });
      const directed = Array.from(card.querySelectorAll("[dir]"));
      expect(directed).toHaveLength(1);
      expect(directed[0]).toHaveTextContent("أرز بسمتي");
      // The scope boundary: the card itself and the grid stay undirected.
      expect(card).not.toHaveAttribute("dir");
      expect(card.parentElement).not.toHaveAttribute("dir");
      expect(document.documentElement).not.toHaveAttribute("dir");
    });

    it("keeps arrow-key grid navigation intact with second names present", async () => {
      withProducts([named(0, "أرز"), named(1, "ملح"), named(2, "")]);
      render(<BillingPage />);
      const grid = (await screen.findByRole("button", { name: /Product 0/ })).parentElement!;
      const cards = Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
      // Still exactly one focusable element per product - the extra text is
      // a <p>, not another control.
      expect(cards).toHaveLength(3);

      cards[0].focus();
      fireEvent.keyDown(cards[0], { key: "ArrowRight" });
      expect(cards[1]).toHaveFocus();
      fireEvent.keyDown(cards[1], { key: "ArrowRight" });
      expect(cards[2]).toHaveFocus();
      fireEvent.keyDown(cards[2], { key: "ArrowLeft" });
      expect(cards[1]).toHaveFocus();
      // Clamps at the left edge rather than escaping the grid.
      cards[0].focus();
      fireEvent.keyDown(cards[0], { key: "ArrowLeft" });
      expect(cards[0]).toHaveFocus();
    });

    it("still adds a product whose card carries a second name", async () => {
      withProducts([named(0, "أرز بسمتي")]);
      render(<BillingPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Product 0/ }));
      await waitFor(() =>
        expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
          product_id: "product-0",
          quantity: "1.000",
        }),
      );
    });
  });

  // Product cards gained an image (and a placeholder for products without
  // one). Both render inside the card button, so this guards the grid's
  // arrow-key navigation, which resolves cards by querying the grid for
  // `button` elements and indexing into that list: any extra focusable
  // element inside a card would silently shift every index.
  describe("product grid arrow-key navigation with images", () => {
    const withImage = (index: number, imageUrl: string | null): InventoryItem => ({
      ...inventoryItem,
      product: {
        ...inventoryItem.product,
        id: `product-${index}`,
        name: `Product ${index}`,
        sku: `SKU-${index}`,
        barcode: `barcode-${index}`,
        image_url: imageUrl,
        category: { id: "category-id", name: "Dairy", secondary_name: "" },
      secondary_name: "",
      },
    });

    beforeEach(() => {
      inventory.list.mockResolvedValue({
        success: true,
        message: "",
        data: {
          count: 4,
          next: null,
          previous: null,
          results: [
            withImage(0, "http://localhost:8000/media/product-images/0.jpg"),
            withImage(1, null),
            withImage(2, "http://localhost:8000/media/product-images/2.png"),
            withImage(3, null),
          ],
        },
      });
    });

    async function productCards() {
      await screen.findByText("Product 0");
      const grid = screen.getByText("Product 0").closest("button")?.parentElement;
      return Array.from(grid?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    }

    it("renders exactly one focusable card per product", async () => {
      render(<BillingPage />);
      const cards = await productCards();
      expect(cards).toHaveLength(4);
      expect(cards.map((card) => card.textContent)).toEqual([
        expect.stringContaining("Product 0"),
        expect.stringContaining("Product 1"),
        expect.stringContaining("Product 2"),
        expect.stringContaining("Product 3"),
      ]);
    });

    it("shows a real image where one exists and a placeholder where it does not", async () => {
      render(<BillingPage />);
      const cards = await productCards();
      expect(cards[0].querySelector("img")).toHaveAttribute(
        "src",
        "http://localhost:8000/media/product-images/0.jpg",
      );
      expect(cards[1].querySelector("img")).toBeNull();
      expect(cards[1].querySelector("[data-testid='product-thumb-placeholder']")).not.toBeNull();
    });

    it("moves focus across cards with ArrowRight and ArrowLeft", async () => {
      render(<BillingPage />);
      const cards = await productCards();
      cards[0].focus();
      fireEvent.keyDown(cards[0], { key: "ArrowRight" });
      expect(cards[1]).toHaveFocus();
      fireEvent.keyDown(cards[1], { key: "ArrowRight" });
      expect(cards[2]).toHaveFocus();
      fireEvent.keyDown(cards[2], { key: "ArrowLeft" });
      expect(cards[1]).toHaveFocus();
    });

    it("clamps at the grid edges instead of escaping the grid", async () => {
      render(<BillingPage />);
      const cards = await productCards();
      cards[0].focus();
      fireEvent.keyDown(cards[0], { key: "ArrowLeft" });
      expect(cards[0]).toHaveFocus();
      cards[3].focus();
      fireEvent.keyDown(cards[3], { key: "ArrowRight" });
      expect(cards[3]).toHaveFocus();
    });

    it("still adds the focused product to the draft on click", async () => {
      render(<BillingPage />);
      const cards = await productCards();
      cards[2].focus();
      fireEvent.click(cards[2]);
      await waitFor(() =>
        expect(billing.addItem).toHaveBeenCalledWith("draft-id", {
          product_id: "product-2",
          quantity: "1.000",
        }),
      );
    });
  });

  describe("keyboard shortcuts", () => {
    const draftWithItem: DraftSale = {
      ...draft,
      items: [{
        id: "item-id",
        product: { id: "product-id", name: "Baladna Milk", secondary_name: "", sku: "MILK-001", barcode: "6281007023412", unit: "BOTTLE", image_url: null },
        pricing_mode: "STANDARD",
        packet_size: null,
        quantity: "1",
        stock_quantity: "1",
        unit_price: "6.00",
        tax_rate: "5.00",
        is_tax_inclusive: false,
        tax_amount: "0.30",
        line_subtotal: "6.00",
        line_total: "6.30",
      }],
    };

    it("focuses the search input on '/'", async () => {
      render(<BillingPage />);
      await screen.findByText("Cart is empty");
      const search = screen.getByLabelText("Product or barcode search");
      search.blur();
      fireEvent.keyDown(document, { key: "/" });
      expect(search).toHaveFocus();
    });

    function openDialogText(container: HTMLElement) {
      return container.querySelector("dialog[open]")?.textContent ?? "";
    }

    it("opens the shortcuts cheat sheet on '?'", async () => {
      const { container } = render(<BillingPage />);
      await screen.findByText("Cart is empty");
      expect(openDialogText(container)).toBe("");
      fireEvent.keyDown(document, { key: "?" });
      expect(openDialogText(container)).toContain("Keyboard shortcuts");
      expect(openDialogText(container)).toContain("Continue to payment");
    });

    it("opens the cancel confirmation on F4 even with an empty cart", async () => {
      const { container } = render(<BillingPage />);
      await screen.findByText("Cart is empty");
      fireEvent.keyDown(document, { key: "F4" });
      expect(openDialogText(container)).toContain("Cancel this draft?");
    });

    it("does not open the payment dialog on F9 with an empty cart", async () => {
      const { container } = render(<BillingPage />);
      await screen.findByText("Cart is empty");
      fireEvent.keyDown(document, { key: "F9" });
      expect(openDialogText(container)).toBe("");
    });

    it("opens the payment dialog on F9 once the cart has items", async () => {
      billing.create.mockResolvedValue({ success: true, message: "", data: draftWithItem });
      const { container } = render(<BillingPage />);
      await screen.findByText("Baladna Milk");
      fireEvent.keyDown(document, { key: "F9" });
      expect(openDialogText(container)).toContain("Complete payment");
    });

    it("holds the bill on F8 once the cart has items", async () => {
      billing.create.mockResolvedValue({ success: true, message: "", data: draftWithItem });
      billing.hold.mockResolvedValue({ success: true, message: "", data: draftWithItem });
      render(<BillingPage />);
      await screen.findByText("Baladna Milk");
      fireEvent.keyDown(document, { key: "F8" });
      await waitFor(() => expect(billing.hold).toHaveBeenCalledWith("draft-id"));
    });

    it("still triggers an F-key shortcut while the search field has focus", async () => {
      const { container } = render(<BillingPage />);
      await screen.findByText("Cart is empty");
      const search = screen.getByLabelText("Product or barcode search");
      search.focus();
      fireEvent.keyDown(search, { key: "F4" });
      expect(openDialogText(container)).toContain("Cancel this draft?");
    });
  });
});
