// Locale-aware formatting helpers (pure — usable on server and client).

export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(value);
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 8,
  }).format(value);
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(ratio);
}

export function formatSignedCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    signDisplay: "exceptZero",
  }).format(value);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    new Date(date),
  );
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

// For <input type="date"> default values.
export function toDateInputValue(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}
