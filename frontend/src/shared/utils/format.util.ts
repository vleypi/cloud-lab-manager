

const NUMBER_FORMATTER = new Intl.NumberFormat("ru-RU");
const PERCENT_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "decimal",
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  return `${PERCENT_FORMATTER.format(value)} %`;
}

export function formatMegabytes(mb: number): string {
  if (mb >= 1_048_576) return `${(mb / 1_048_576).toFixed(1)} ТБ`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} ГБ`;
  return `${formatNumber(Math.round(mb))} МБ`;
}

export function formatGigabytes(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} ТБ`;
  return `${formatNumber(Math.round(gb))} ГБ`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const sec = seconds % 60;
    return sec > 0 ? `${minutes} мин ${sec} с` : `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  const min = minutes % 60;
  return min > 0 ? `${hours} ч ${min} мин` : `${hours} ч`;
}

export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" });

export function formatRelative(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "—";
  const date = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);

  const abs = Math.abs(diffSec);
  if (abs < 60) return RELATIVE_FORMATTER.format(diffSec, "second");
  if (abs < 3600) return RELATIVE_FORMATTER.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RELATIVE_FORMATTER.format(Math.round(diffSec / 3600), "hour");
  return RELATIVE_FORMATTER.format(Math.round(diffSec / 86400), "day");
}

export function formatDateTime(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "—";
  const date = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  return DATE_FORMATTER.format(date);
}

export function formatTimeUntil(isoDate: string | Date | null | undefined): string {
  if (!isoDate) return "—";
  const date = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "истёк";
  return formatDuration(Math.floor(diffMs / 1000));
}
