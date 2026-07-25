const DASHBOARD_SALE_NUMBER = /^NXP-[A-Z0-9]+-\d{8}-(\d{6})$/i;

export function formatDashboardSaleReference(value: string) {
  const normalized = value.trim();
  if (!normalized) return "—";
  const match = DASHBOARD_SALE_NUMBER.exec(normalized);
  return match ? `NXP-${match[1]}` : normalized;
}

function zonedDay(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function formatDashboardSaleTime(
  value: string,
  timezone: string,
  now = new Date(),
) {
  const completedAt = new Date(value);
  if (Number.isNaN(completedAt.getTime())) return "—";
  const time = new Intl.DateTimeFormat("en-QA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(completedAt);
  if (zonedDay(completedAt, timezone) === zonedDay(now, timezone)) return time;
  const date = new Intl.DateTimeFormat("en-QA", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).format(completedAt);
  return `${date} · ${time}`;
}
