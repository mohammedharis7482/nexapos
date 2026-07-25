const qarFormatter = new Intl.NumberFormat("en-QA", {
  style: "currency",
  currency: "QAR",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: string | number, currency = "QAR") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${currency} —`;
  if (currency === "QAR") return qarFormatter.format(numeric).replace(/\s+/g, " ");
  return new Intl.NumberFormat("en-QA", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric).replace(/\s+/g, " ");
}

export function formatQuantity(value: string | number, maximumFractionDigits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-QA", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
    useGrouping: true,
  }).format(numeric);
}

export function formatPercentage(value: string | number, fractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(fractionDigits)}%`;
}

export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-QA", options).format(date);
}
