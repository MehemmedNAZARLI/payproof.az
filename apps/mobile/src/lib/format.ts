import { formatDate as sharedDate } from "@payproof/api-client/format";

import { t } from "./i18n";

export { formatMoney } from "@payproof/api-client/format";

// Dates are shown in Baku time, as the business and the fixtures keep them, on any device.
const ZONE = "Asia/Baku";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// Sunday first, as Date#getDay counts.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function bakuParts(date: Date) {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    partsFormat.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  const [year, month, day] = [get("year"), get("month"), get("day")];
  // The calendar day in Baku, read back as UTC, gives its weekday without the device's zone.
  const weekday = new Date(`${year}-${month}-${day}T00:00:00Z`).getUTCDay();
  return { year, month, day, hour: Number(get("hour")), minute: get("minute"), weekday };
}

export function formatDate(value: string): string {
  // Keep the shared helper's strict calendar/offset validation, then render English text.
  const [day, month, year] = sharedDate(value).split(".");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function formatDateTime(value: string): string {
  const date = formatDate(value);
  return value.includes("T") ? `${date}, ${formatTime(value)}` : date;
}

/** "8 noyabr 2026, bazar" */
export function formatLongDate(date: Date): string {
  const p = bakuParts(date);
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}, ${WEEKDAYS[p.weekday]}`;
}

/** The greeting for the time of day in Baku. */
export function greeting(date: Date): string {
  const { hour } = bakuParts(date);
  if (hour >= 5 && hour < 12) return t.home.greeting.morning;
  if (hour >= 12 && hour < 18) return t.home.greeting.afternoon;
  return t.home.greeting.evening;
}

/** "15:53" in Baku time. */
export function formatTime(iso: string): string {
  const p = bakuParts(new Date(iso));
  return `${String(p.hour).padStart(2, "0")}:${p.minute}`;
}

/** The Baku calendar day of a moment, as "2026-11-06" (sorts and compares as text). */
export function bakuDay(date: Date): string {
  const p = bakuParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** A day heading relative to `now`: "Today", "Yesterday", "6 noyabr, cümə" (year if not this one). */
export function formatDayHeading(day: string, now: Date): string {
  const today = bakuDay(now);
  const yesterday = bakuDay(new Date(Date.parse(`${today}T12:00:00+04:00`) - 86_400_000));
  if (day === today) return t.time.today;
  if (day === yesterday) return t.time.yesterday;
  const [year, month, d] = day.split("-");
  const weekday = WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
  const sameYear = year === today.slice(0, 4);
  return `${Number(d)} ${MONTHS[Number(month) - 1]}${sameYear ? "" : ` ${year}`}, ${weekday}`;
}
