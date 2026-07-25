# Design System V2 migration guide

This phase introduces V2 without broadly reconstructing business pages. Existing routes continue through compatibility tokens and wrappers. Migrate one route at a time in a later phase and keep behavior, API contracts, calculations, and permissions unchanged.

## Component classification

### V2 ready

- `Button`, `IconButton`
- `Input`, `SearchInput`, `Select`, `Textarea`, `PasswordInput`
- `Checkbox`, `SegmentedControl`, `MoneyInput`, `QuantityInput`, `PercentageInput`
- `FormField`
- `SurfaceCard`, `SectionCard`, `MetricCard`, `SummaryCard`, `ActionCard`, `ListCard`
- `Badge`, `StockStatusBadgeV2`, `SaleStatusBadge`, `PaymentMethodBadge`, `RoleBadge`
- `Dialog`, `ConfirmDialog`, `Drawer`, `Sheet`, `DropdownMenu`, `Popover`, `Tooltip`
- `Alert`, `Toast`, `EmptyState`, `ErrorState`
- `CardSkeleton`, `FormSkeleton`, `PageSkeleton`, `TableSkeleton`
- `DataTable` family, `ResponsiveDataList`, `MobileDataCard`
- `Money`, `Quantity`, `Percentage`, `DateTime`
- `AppPage`, `PageContainer`, `WidePageContainer`, `FocusedWorkspace`, `ResponsiveGrid`, `SplitPane`, `StickyActionBar`
- Application Shell V2 navigation and account controls

### Requires migration

- Feature pages using raw `<table>` elements.
- Feature pages using `Card` directly when a more specific V2 card fits.
- Page-specific search wrappers instead of `SearchInput`.
- Form checkboxes that do not yet use `Checkbox`.
- Pages using direct `QAR ${value}` or unformatted quantities.
- Page-specific skeleton arrangements.
- Report/dashboard chart markup; retain until their dedicated reconstruction phase.

### Deprecated compatibility APIs

- `Card` as a feature-level semantic choice. It remains the low-level base.
- `PageContainer` exported from `components/ui/display.tsx`; new work imports it from `components/ui/layout.tsx`.
- `StockStatusBadge` from `components/inventory/stock-status.tsx`; it wraps `StockStatusBadgeV2`.
- `PaymentBadge`; migrate single methods to `PaymentMethodBadge`.
- Button variant `danger`; use `destructive`.
- CSS aliases `--app-background`, `--text-*`, `--primary*`, `--surface-secondary`, `--shadow-card`, and `--shadow-elevated`.
- `.premium-action-primary` and `.premium-action-secondary`; use Button or a future link-button primitive.

### Safe to remove later

- `ModulePlaceholder` after confirming no route imports it.
- Compatibility token aliases after `rg` finds no consumers.
- Deprecated display PageContainer after all imports move.
- Legacy stock-status wrapper after all inventory imports move.

Nothing is removed during V2 foundation work unless it is unused and a fully compatible replacement is already active.

## Route migration sequence

1. Dashboard and Login in their dedicated next phase.
2. Products and Categories.
3. Inventory list, detail, and dialogs.
4. Billing, cart, payment, and success.
5. Sales, detail, and receipt preview.
6. Reports.
7. Settings.

For every route:

1. Record current behavior and tests.
2. Replace layout with AppPage, WidePageContainer, or FocusedWorkspace.
3. Use one PageHeader and semantic sections.
4. Replace raw filters with FilterBar and SearchInput.
5. Replace desktop-only tables with DataTable plus ResponsiveDataList cards.
6. Replace money, quantity, percentage, and date interpolation with format components.
7. Replace ad-hoc statuses with domain badges.
8. Replace raw loading/empty/error UI with shared states.
9. Verify OWNER/CASHIER visibility, API calls, and mutation behavior.
10. Test 360, 390, 430, 768, 1024, 1280, and 1440px.
11. Remove compatibility usage only after the route passes lint, tests, build, and visual review.

## Compatibility rules

- Do not change service functions, schemas, or API types during visual migration.
- Keep V1 names only as wrappers or token aliases, never as divergent implementations.
- New components must use semantic V2 tokens.
- Do not install a second component framework or icon library.
- Do not combine page redesign and backend behavior changes.
- Do not delete compatibility APIs while imported by working routes.

## Completion criteria for a migrated page

- No arbitrary colour/radius/control-size values without a documented exception.
- Currency never truncates and uses Money.
- Quantities use Quantity and meaningful display precision.
- Desktop table and mobile data cards are intentional.
- Loading resembles final content.
- Empty and error states provide safe next actions.
- All icon buttons are named.
- Keyboard focus is visible.
- No horizontal page overflow at supported widths.
- Existing functional tests still pass and targeted V2 tests cover composition.
