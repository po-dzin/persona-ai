const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

export function formatDateTimeShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_TIME_FORMATTER.format(date);
}

export function formatDayMonth(input: string): string {
  const isoDay = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) return `${isoDay[3]}.${isoDay[2]}`;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input).slice(0, 5);
  return DAY_MONTH_FORMATTER.format(date);
}
