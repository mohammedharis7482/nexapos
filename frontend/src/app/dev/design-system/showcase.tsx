"use client";

import { Boxes, PackagePlus, Save, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { MobileNavItem, NavItem, NavSection, NexaPOSBrand } from "@/components/layout/app-shell";
import { navigationItems } from "@/components/layout/navigation";
import { ActionCard, ListCard, SummaryCard, SurfaceCard } from "@/components/ui/card";
import { Badge, DateTime, MetricCard, Money, PageHeader, Percentage, Quantity } from "@/components/ui/display";
import { Alert, CardSkeleton, EmptyState, ErrorState, FormSkeleton, PageSkeleton, Toast } from "@/components/ui/feedback";
import { Checkbox, FormField, Input, MoneyInput, PercentageInput, QuantityInput, RadioGroup, SearchInput, SegmentedControl, Select, Switch, Textarea } from "@/components/ui/input";
import { AppPage, FilterBar, ResponsiveGrid, Section, SectionCard, SplitPane, StickyActionBar } from "@/components/ui/layout";
import { ConfirmDialog, Dialog, Drawer, Tooltip } from "@/components/ui/overlay";
import { PaymentMethodBadge, RoleBadge, SaleStatusBadge, StockStatusBadgeV2 } from "@/components/ui/status";
import { DataTable, DataTableBody, DataTableCell, DataTableHeader, DataTableHeading, DataTableRow, ResponsiveDataList, TableSkeleton } from "@/components/ui/table";

const swatches = [
  ["Brand", "bg-primary"],
  ["Background", "bg-background"],
  ["Surface", "bg-surface"],
  ["Success", "bg-success"],
  ["Warning", "bg-warning"],
  ["Danger", "bg-danger"],
  ["Information", "bg-info"],
];

export function DesignSystemShowcase() {
  const [segment, setSegment] = useState<"cash" | "card">("cash");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [enabled, setEnabled] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const table = (
    <DataTable>
      <DataTableHeader><DataTableRow><DataTableHeading>Item</DataTableHeading><DataTableHeading>Status</DataTableHeading><DataTableHeading align="right">Value</DataTableHeading></DataTableRow></DataTableHeader>
      <DataTableBody>
        <DataTableRow><DataTableCell className="font-semibold">Sample product</DataTableCell><DataTableCell><StockStatusBadgeV2 status="IN_STOCK" /></DataTableCell><DataTableCell align="right" numeric><Money value="24.50" /></DataTableCell></DataTableRow>
        <DataTableRow><DataTableCell className="font-semibold">Weighted item</DataTableCell><DataTableCell><StockStatusBadgeV2 status="LOW_STOCK" /></DataTableCell><DataTableCell align="right" numeric><Quantity value="1.250" unit="KG" /></DataTableCell></DataTableRow>
      </DataTableBody>
    </DataTable>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <AppPage>
        <PageHeader eyebrow="Development only" title="NexaPOS Design System V2" description="A neutral verification surface for production UI foundations. This route returns 404 in production." />

        <Section aria-labelledby="shell-title">
          <h2 id="shell-title" className="type-section-title">Application shell V2</h2>
          <div className="hidden min-h-[420px] overflow-hidden rounded-[var(--radius-xl)] border border-border bg-background shadow-[var(--shadow-xs)] lg:grid lg:grid-cols-[var(--sidebar-width)_1fr]">
            <aside className="flex flex-col border-r border-border bg-surface p-3">
              <NexaPOSBrand />
              <nav className="mt-7 flex-1" aria-label="Shell specimen navigation">
                <NavSection label="Workspace">{navigationItems.slice(0, 5).map((item) => <NavItem key={item.href} item={item} active={item.href === "/dashboard"} />)}</NavSection>
              </nav>
              <div className="border-t border-border p-2"><p className="text-xs font-semibold">Example Owner</p><p className="text-[11px] text-foreground-muted">Owner · Example Grocery</p></div>
            </aside>
            <div>
              <header className="flex min-h-[var(--header-height)] items-center justify-between border-b border-border bg-surface px-5"><div><p className="type-eyebrow text-foreground-muted">Active shop</p><p className="text-sm font-semibold">Example Grocery</p></div><Badge tone="success">Network online</Badge></header>
              <div className="p-6"><p className="type-eyebrow text-primary">Page context</p><p className="mt-2 type-page-title">Operational workspace</p><div className="mt-6 grid grid-cols-3 gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div></div>
            </div>
          </div>
          <SurfaceCard className="lg:hidden" padding="none">
            <header className="flex min-h-[var(--header-height)] items-center justify-between border-b border-border px-3"><NexaPOSBrand compact /><p className="text-sm font-semibold">Example Grocery</p></header>
            <div className="p-4"><p className="type-page-title">Mobile workspace</p><p className="mt-2 type-body-sm text-foreground-muted">Content remains clear above persistent navigation.</p></div>
            <nav className="grid grid-cols-5 border-t border-border p-1" aria-label="Mobile shell specimen">{navigationItems.slice(0, 5).map((item) => <MobileNavItem key={item.href} item={item} active={item.href === "/dashboard"} />)}</nav>
          </SurfaceCard>
        </Section>

        <Section aria-labelledby="foundations-title">
          <h2 id="foundations-title" className="type-section-title">Foundations</h2>
          <ResponsiveGrid min="150px">
            {swatches.map(([label, colour]) => <SurfaceCard key={label} padding="sm"><div className={`h-16 rounded-[var(--radius-md)] border border-border ${colour}`} /><p className="mt-3 type-body-sm font-semibold">{label}</p></SurfaceCard>)}
          </ResponsiveGrid>
          <SurfaceCard>
            <p className="type-eyebrow text-primary">Typography</p>
            <p className="mt-3 type-display">Display heading</p>
            <p className="mt-4 type-page-title">Page title</p>
            <p className="mt-3 type-section-title">Section title</p>
            <p className="mt-2 type-body-lg text-foreground-secondary">Readable operational copy for non-technical users.</p>
            <p className="mt-2 type-body-sm text-foreground-muted">Helper text remains readable and concise.</p>
          </SurfaceCard>
          <ResponsiveGrid min="180px">
            <SurfaceCard><p className="type-body-sm font-semibold">Radii</p><div className="mt-3 flex gap-3"><span className="size-12 rounded-[var(--radius-sm)] bg-primary-soft" /><span className="size-12 rounded-[var(--radius-md)] bg-primary-soft" /><span className="size-12 rounded-[var(--radius-xl)] bg-primary-soft" /></div></SurfaceCard>
            <SurfaceCard><p className="type-body-sm font-semibold">Shadows</p><div className="mt-3 flex gap-3"><span className="size-12 rounded-lg border border-border bg-surface shadow-[var(--shadow-xs)]" /><span className="size-12 rounded-lg border border-border bg-surface shadow-[var(--shadow-sm)]" /><span className="size-12 rounded-lg border border-border bg-surface shadow-[var(--shadow-md)]" /></div></SurfaceCard>
            <SurfaceCard><p className="type-body-sm font-semibold">Spacing</p><div className="mt-3 flex items-end gap-2">{[4, 8, 12, 16, 24, 32].map((size) => <span key={size} className="bg-primary-soft text-center text-[9px] text-primary" style={{ width: size, height: size }}>{size}</span>)}</div></SurfaceCard>
          </ResponsiveGrid>
        </Section>

        <SectionCard title="Buttons and interaction" description="Variants, sizes, loading, destructive intent, and icon-only actions.">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <Button size="sm">Small</Button><Button>Primary</Button><Button size="lg">Large</Button>
            <Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button>
            <Button variant="success">Success</Button><Button variant="destructive" leadingIcon={<Trash2 className="size-4" />}>Destructive</Button>
            <Button loading>Saving</Button><Button disabled>Disabled</Button>
            <Tooltip label="Add item"><IconButton aria-label="Add item" variant="secondary"><PackagePlus className="size-4" /></IconButton></Tooltip>
          </div>
        </SectionCard>

        <SectionCard title="Form controls" description="Consistent labels, hints, errors, adornments, and selection controls.">
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <FormField label="Product name" htmlFor="demo-product" hint="Use the customer-facing name." required><Input id="demo-product" placeholder="Sample product" /></FormField>
            <FormField label="Search" htmlFor="demo-search"><SearchInput id="demo-search" placeholder="Search catalogue" /></FormField>
            <FormField label="Category" htmlFor="demo-category"><Select id="demo-category"><option>General grocery</option></Select></FormField>
            <FormField label="Selling price" htmlFor="demo-money"><MoneyInput id="demo-money" defaultValue="24.50" /></FormField>
            <FormField label="Quantity" htmlFor="demo-quantity"><QuantityInput id="demo-quantity" unit="kg" defaultValue="1.250" /></FormField>
            <FormField label="Tax rate" htmlFor="demo-tax"><PercentageInput id="demo-tax" defaultValue="0.00" /></FormField>
            <FormField label="Invalid field" htmlFor="demo-invalid" error="Please check this value."><Input id="demo-invalid" invalid /></FormField>
            <FormField label="Notes" htmlFor="demo-notes"><Textarea id="demo-notes" placeholder="Optional operational note" /></FormField>
            <Checkbox label="Active product" description="Available for billing and inventory." defaultChecked />
            <SegmentedControl label="Payment method" value={segment} onChange={setSegment} options={[{ value: "cash", label: "Cash" }, { value: "card", label: "Card" }]} />
            <RadioGroup label="Density" value={density} onChange={setDensity} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
            <Switch label="Availability" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </SectionCard>

        <Section aria-labelledby="cards-title">
          <h2 id="cards-title" className="type-section-title">Cards and values</h2>
          <ResponsiveGrid>
            <MetricCard label="Today’s sales" value={<Money value="843.50" />} detail="Completed sales only" icon={ShoppingCart} />
            <SummaryCard label="Quantity on hand" value={<Quantity value="18.500" unit="KG" />} footer="Meaningful precision only" />
            <ActionCard icon={<Boxes className="size-5" />} title="Inventory attention" description="Review products that need an operational update." action={<Button variant="outline" size="sm">Review</Button>} />
          </ResponsiveGrid>
          <SurfaceCard><div className="flex flex-wrap items-center gap-3"><Money value="843.50" /><Quantity value="12.500" unit="KG" /><Percentage value="60" /><DateTime value="2026-07-24T09:00:00Z" /></div></SurfaceCard>
        </Section>

        <SectionCard title="Statuses and badges" description="Every state includes a readable label and icon or marker.">
          <div className="flex flex-wrap gap-2 p-5">
            <Badge>Neutral</Badge><Badge tone="primary">Information</Badge><RoleBadge role="OWNER" /><RoleBadge role="CASHIER" />
            <StockStatusBadgeV2 status="IN_STOCK" /><StockStatusBadgeV2 status="LOW_STOCK" /><StockStatusBadgeV2 status="OUT_OF_STOCK" />
            <SaleStatusBadge status="COMPLETED" /><SaleStatusBadge status="DRAFT" /><PaymentMethodBadge method="CASH" /><PaymentMethodBadge method="CARD" />
          </div>
        </SectionCard>

        <Section aria-labelledby="table-title">
          <h2 id="table-title" className="type-section-title">Responsive data presentation</h2>
          <ResponsiveDataList table={table} cards={<><SurfaceCard padding="sm"><p className="font-semibold">Sample product</p><div className="mt-3 flex items-center justify-between"><StockStatusBadgeV2 status="IN_STOCK" /><Money value="24.50" /></div></SurfaceCard><SurfaceCard padding="sm"><p className="font-semibold">Weighted item</p><div className="mt-3 flex items-center justify-between"><StockStatusBadgeV2 status="LOW_STOCK" /><Quantity value="1.250" unit="KG" /></div></SurfaceCard></>} />
          <TableSkeleton columns={3} rows={2} />
        </Section>

        <SectionCard title="Dialogs, drawers, and menus" description="Native dialog semantics provide focus containment, Escape, and focus return.">
          <div className="flex flex-wrap gap-3 p-5">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Open confirmation</Button>
          </div>
        </SectionCard>

        <Section aria-labelledby="feedback-title">
          <h2 id="feedback-title" className="type-section-title">Feedback and states</h2>
          <div className="grid gap-3"><Alert title="Changes saved" tone="success">The update is available immediately.</Alert><Alert title="Review required" tone="warning">Check the entered quantity before continuing.</Alert><Alert title="Server unavailable">The service could not be reached. Your entered values remain on screen.</Alert></div>
          <ResponsiveGrid><Toast title="Product saved" description="Catalogue details were updated." tone="success" /><EmptyState compact title="No products found" description="Try another search." action={<Button size="sm">Clear search</Button>} /><ErrorState title="Section unavailable" description="This section could not be loaded." /></ResponsiveGrid>
          <ResponsiveGrid><CardSkeleton /><FormSkeleton /></ResponsiveGrid>
          <SurfaceCard><PageSkeleton /></SurfaceCard>
        </Section>

        <Section aria-labelledby="layouts-title">
          <h2 id="layouts-title" className="type-section-title">Responsive layouts</h2>
          <SplitPane primary={<SurfaceCard><p className="font-semibold">Primary workspace</p><p className="mt-1 text-sm text-foreground-muted">Expands for operational content.</p></SurfaceCard>} secondary={<SurfaceCard><p className="font-semibold">Sticky summary</p><p className="mt-1 text-sm text-foreground-muted">Stacks below on smaller screens.</p></SurfaceCard>} />
          <FilterBar><SearchInput aria-label="Example filter" placeholder="Filter example" /></FilterBar>
          <ListCard><div className="p-4">List row one</div><div className="p-4">List row two</div></ListCard>
          <StickyActionBar><Button variant="secondary">Cancel</Button><Button leadingIcon={<Save className="size-4" />}>Save changes</Button></StickyActionBar>
        </Section>
      </AppPage>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Example dialog" description="A neutral design-system interaction." footer={<Button onClick={() => setDialogOpen(false)}>Done</Button>}><p className="text-sm text-foreground-secondary">Dialog content remains scrollable while actions stay available.</p></Dialog>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Example drawer"><p className="text-sm text-foreground-secondary">Drawers support secondary workflows without losing page context.</p></Drawer>
      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Remove this example?" description="This neutral example demonstrates a safe destructive confirmation." confirmLabel="Remove example" onConfirm={() => setConfirmOpen(false)} />
    </main>
  );
}
