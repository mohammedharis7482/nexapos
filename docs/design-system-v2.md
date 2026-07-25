# NexaPOS Premium Design System V2

## Product direction

NexaPOS is an operational grocery product for small shops in Qatar. Its interface is reliable, efficient, precise, modern, approachable, and business-focused. Clarity and speed take priority over decoration. The system uses one professional sans-serif family (Inter), a restrained professional blue, navy-charcoal foreground, cool-neutral backgrounds, white surfaces, fine borders, and quiet semantic colours.

The system does not use dark mode, glassmorphism, default gradients, decorative analytics, invented business information, large illustrations, or heavy shadows.

## Design principles

1. Clarity before decoration.
2. Operational speed before novelty.
3. Consistency before page-specific styling.
4. Real information before decorative content.
5. Strong hierarchy without excessive size.
6. Dense enough for POS work without becoming cramped.
7. Responsive composition instead of shrinking desktop layouts.
8. Accessible interaction states.
9. Minimal, interruptible motion.
10. No fake business information.

## Colour tokens

Tokens live in `frontend/src/app/globals.css` and are exposed to Tailwind through `@theme inline`.

- Brand: `--brand-50` through `--brand-900`. Use 600 for primary actions, 700 for hover, and 50–100 for selected/subtle surfaces.
- Surfaces: `--background`, `--surface`, `--surface-subtle`, `--surface-muted`, `--surface-elevated`, `--surface-hover`, `--surface-active`.
- Foreground: `--foreground`, `--foreground-secondary`, `--foreground-muted`, `--foreground-disabled`, `--foreground-inverse`.
- Borders: `--border-subtle`, `--border-default`, `--border-strong`, `--border-focus`.
- Feedback: success, warning, danger, and information each have foreground, background, and border tokens.
- Retail: stock, sale, and payment tokens encode domain meaning. UI must also include a readable label and icon/marker.
- Focus and selection: `--focus-ring` and `--selection-background`.

Compatibility aliases such as `--primary`, `--text-primary`, and `--surface-secondary` remain temporarily for V1 consumers.

## Typography

Use Inter everywhere. The global type utilities are:

- `.type-display`: exceptional showcase/empty onboarding headings only.
- `.type-eyebrow`: short uppercase context.
- `.type-page-title`: the single route-level heading.
- `.type-section-title`: card and section headings.
- `.type-body-lg`, `.type-body`, `.type-body-sm`, `.type-caption`.
- `.type-numeric`: prices, totals, quantities, counts, and percentages.

Page titles are responsive but never oversized. Helper text must normally be at least 13px. Financial values use tabular numbers, remain on one line, and must never use truncation.

## Spacing

The only foundation scale is 4, 8, 12, 16, 20, 24, 32, 40, 48, and 64px (`--space-1` through `--space-16`).

- Inline icon gap: 8px.
- Closely related controls: 8–12px.
- Field internal gap: 6–8px.
- Form fields: 16–20px.
- Default card padding: 20px.
- Section gap: 24px.
- Page padding: 16px mobile, scaling to 32px desktop.
- Table cells: 18px horizontal.
- Dialog/drawer padding: 16px mobile and 20px desktop.

## Shape and elevation

- `--radius-sm`: small indicators.
- `--radius-md`: controls and navigation.
- `--radius-lg`: cards.
- `--radius-xl`: dialogs.
- `--radius-full`: pills and circular controls.
- `--shadow-xs`: quiet surface definition.
- `--shadow-sm`: floating compact controls.
- `--shadow-md`: dialogs, drawers, dropdowns, and toasts only.

Most cards use a border and either no shadow or `--shadow-xs`.

## Control dimensions

- Small: 36px (`--control-sm`).
- Default: 44px (`--control-md`).
- Large/billing: 48px (`--control-lg`).
- Icon buttons follow the same scale.
- Navigation rows: 42px.
- Table rows: 56px.
- Header: 60px.
- Sidebar: 200px.
- Mobile navigation: 72px plus safe-area inset.

## Responsive architecture

| Width | Composition |
| --- | --- |
| 360–430px | 16px gutter, single-column forms/cards, bottom navigation, mobile data cards |
| 768px | 24px gutter, two-column forms/grids where useful, bottom navigation remains |
| 1024px | Persistent 200px sidebar, desktop header, semantic tables |
| 1280px | 24–32px gutter, full operational split panes |
| 1440px+ | Constrained normal pages; wide dashboard/POS workspaces |

Tables transform through `ResponsiveDataList`; they must not force horizontal page scrolling. Dialog content is viewport constrained and scrollable. Sheets provide secondary workflows on smaller screens.

## Layout components

- `AppPage`: standard vertical page rhythm and normal maximum width.
- `PageContainer`: normal content boundary.
- `WidePageContainer`: dashboards, reports, and data-heavy workspaces.
- `FocusedWorkspace`: billing/POS layout.
- `ResponsiveGrid`: repeatable content-aware cards.
- `SplitPane`: primary workspace with sticky secondary summary.
- `Section`, `SectionHeader`, and `SectionCard`: semantic content grouping.
- `FilterBar`: dense query controls.
- `StickyActionBar`: reachable save/checkout actions.

Use `PageHeader` once per route. Do not repeat the route title in the application header.

## Application shell

Desktop uses a 200px sidebar at 1024px and above. The sidebar contains compact NexaPOS branding, one simple navigation group, a distinct but balanced New Bill link, and a working account control. The header shows shop context, real browser network state, local date/time, and the existing user menu. It does not invent backend availability or notifications.

Mobile uses role-aware bottom navigation. Owners see Dashboard, Billing, Products, Inventory, and More. Cashiers see Dashboard, Billing, Products, Sales, and More. Active state combines colour, background, `aria-current`, and a visual indicator.

## Components

### Buttons

`Button` variants: primary, secondary, outline, ghost, destructive (`danger` remains a compatibility alias), success, and link. Sizes: `sm`, `md`, and `lg`. Loading overlays the existing content so width remains stable. Use `IconButton` with an accessible name for icon-only actions.

### Forms

Use `FormField` for labels, required indication, hint/error association, and backend validation. Available controls include Input, SearchInput, Select, Textarea, Checkbox, SegmentedControl, PasswordInput, MoneyInput, QuantityInput, and PercentageInput. Preserve user-entered values after recoverable failures.

### Cards

Use `SurfaceCard` as the base. Choose `SectionCard`, `MetricCard`, `SummaryCard`, `ActionCard`, `ChartCard`, `AlertCard`, or `ListCard` based on content. Avoid arbitrary nesting. Metric values must never truncate and must not contain invented comparisons.

### Tables

Use semantic DataTable components with scoped headings. Numeric values use `DataTableCell numeric align="right"`. Use `ResponsiveDataList` to supply designed mobile cards. Use `TableSkeleton` and `TableEmptyState` inside the data region.

### Statuses

Use StockStatusBadgeV2, SaleStatusBadge, PaymentMethodBadge, and RoleBadge. Do not create ad-hoc status colours.

### Dialogs, drawers, and menus

Native dialogs provide focus containment, Escape handling, and focus return. Every dialog needs a title and optional description. Long content scrolls while an optional footer remains visible. `ConfirmDialog` focuses the safe action first. `Drawer`/`Sheet`, DropdownMenu, Popover, and Tooltip share V2 elevation.

### Feedback and states

Use Alert for inline feedback, Toast for non-blocking completion feedback, ConnectionStatus for actual browser network state, and ErrorState for recoverable section/page failures. EmptyState supports compact/full modes, custom icon, and two actions. Loading components resemble final content: CardSkeleton, FormSkeleton, PageSkeleton, and TableSkeleton.

### Values

Use Money, Quantity, Percentage, and DateTime or the functions in `lib/formatters.ts`. Money is formatted as QAR with two decimals. Quantity removes unnecessary trailing zeros while keeping up to three meaningful decimal places.

## Accessibility and motion

Every interactive control has a visible focus ring. Touch targets are approximately 44px by default. Fields associate errors and hints with `aria-describedby`. Status is never colour-only. Data tables remain semantic. Dialogs use accessible names. Reduced-motion users receive near-instant transitions. NexaPOS targets practical WCAG AA fundamentals but does not claim certification.

## Development showcase

`/dev/design-system` renders only in development and tests. Production requests receive Next.js `notFound()`. It contains neutral component data only and no credentials, shop identifiers, or private business records.

## Prohibited patterns

- Arbitrary hex values or page-specific semantic colours.
- Truncated financial values.
- Native `window.alert` or `window.confirm`.
- Icon-only actions without names.
- Status conveyed only through colour.
- Full-screen loading for section refresh.
- Permanent duplicate V1/V2 components.
- Fake metrics, notifications, availability, comparisons, or progress.
- Decorative gradients, glass effects, noisy patterns, or heavy shadows.
