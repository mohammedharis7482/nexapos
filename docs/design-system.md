# NexaPOS design system

## Direction

NexaPOS is a calm, compact operational workspace for grocery-shop owners and
cashiers. It uses a deep-navy brand foundation, clear blue actions, neutral page
and card surfaces, restrained status colours, subtle borders, and minimal
shadows. Decorative marketing patterns, glass effects, fake analytics, and
large in-application hero areas are intentionally excluded.

## Token source

`frontend/src/app/globals.css` is the single CSS token source. Tailwind exposes
the colour variables through `@theme`.

- Brand: `--brand-navy`, `--primary`, `--primary-hover`, `--primary-active`,
  and `--primary-soft`
- Surfaces: `--app-background`, `--surface`, `--surface-secondary`, and
  `--surface-elevated`
- Text: `--text-primary`, `--text-secondary`, and `--text-muted`
- Controls: `--input-border`, `--focus-ring`, `--disabled`, and
  `--control-height`
- Status: success, warning/low-stock, danger/out-of-stock, and information,
  each with a restrained soft background
- Shape and depth: control/card/dialog radii plus card and elevated shadows
- Layout: content maximum, sidebar width, header height, and mobile navigation
  height

Arbitrary colours should not be introduced in feature pages when a semantic
token exists.

## Typography and numbers

Inter remains the only application font. Page titles are 26px with a compact
line height; section titles are 16px; body and form content is at least 14px.
Labels and buttons use a consistent semibold weight. Money and quantities use
tabular figures wherever shared displays or tables render them.

## Layout

The protected shell constrains content to 1440px and uses responsive padding:
16px mobile, 24px tablet, and 28–32px desktop. `.page-stack` is the standard
vertical page rhythm. Billing, dashboards, reports, and data tables may use the
full content width; settings and focused forms use narrower cards.

Desktop navigation begins at 1024px. Below that breakpoint, the application
uses a five-target bottom navigation with a role-aware More sheet. Content
reserves the mobile navigation and safe-area height.

## Shared components

Shared primitives live in `frontend/src/components/ui/`:

- Button and IconButton share height, radii, focus, loading, active, and disabled
  behaviour.
- Input, Select, Textarea, PasswordInput, and FormField share borders, focus
  rings, helper text, and field-level error presentation.
- Card, PageHeader, SectionHeader, PageContainer, FilterBar, and TableFrame
  establish page composition.
- Badge and StockStatusBadge provide text-based status communication; inventory
  status also includes an icon and is never colour-only.
- Alert, EmptyState, ErrorState, Skeleton, Dialog, Sheet, DropdownMenu, and
  ConfirmDialog cover feedback and overlays consistently.
- MoneyDisplay and QuantityDisplay provide tabular operational values.

## Interaction and accessibility

Touch controls target at least 44px. Keyboard focus is a visible semantic blue
ring. Native `dialog.showModal()` provides focus containment and Escape
behaviour; every dialog receives unique labelled-by and described-by IDs.
Destructive actions use a safe default and explicit consequence text. Cart-line
removal uses an inline second step; draft cancellation uses ConfirmDialog.

Semantic headings, real labels, table headings, accessible icon-button names,
`aria-busy`, field error alerts, and text-plus-icon statuses are required.
Reduced-motion preferences collapse transitions and animation durations.
These are practical WCAG AA fundamentals, not a formal certification.

## Feedback

Skeletons should resemble the content that follows and preserve surrounding page
context. Mutations use button-level loading. Empty states explain what is
missing and may provide one relevant action. Errors use plain language, preserve
entered work, and offer Retry only when retrying is safe.

## Receipt printing

Receipt printing targets 80mm paper with a 72mm content area. Only
`.print-receipt` is visible when printing. Navigation, controls, borders,
shadows, and application backgrounds are removed. The same receipt remains
readable in an A4 print dialog.
