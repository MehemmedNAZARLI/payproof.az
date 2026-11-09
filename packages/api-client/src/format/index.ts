// az-AZ display helpers, matching the prototype (money / fD / fDT / fLong).
// Money and quantities stay strings end to end: grouping is done on digits, never via Number().

import type { components } from "../generated/schema";

type Money = components["schemas"]["Money"];

const MONEY = /^(-?)(0|[1-9][0-9]*)\.([0-9]{2})$/;
const QUANTITY = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/;
const MINUS = "−";
const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** `formatMoney("12000.00", "AZN")` → `"12.000,00 AZN"`; `formatMoney("-500.00")` → `"−500,00"`. */
export function formatMoney(money: Money): string;
export function formatMoney(amount: string, currency?: string): string;
export function formatMoney(value: string | Money, currency?: string): string {
  const amount = typeof value === "string" ? value : value.amount;
  const cur = typeof value === "string" ? currency : value.currency;
  const m = MONEY.exec(amount);
  if (!m)
    throw new Error(
      `formatMoney: not a decimal string with 2 fraction digits: ${JSON.stringify(amount)}`,
    );
  const [, sign, int, frac] = m as unknown as [string, string, string, string];
  const negative = sign === "-" && !(int === "0" && frac === "00");
  return `${negative ? MINUS : ""}${group(int)},${frac}${cur ? ` ${cur}` : ""}`;
}

/** `"1200"` → `"1.200"`, `"12.500"` → `"12,5"`. */
export function formatQuantity(qty: string): string {
  const m = QUANTITY.exec(qty);
  if (!m) throw new Error(`formatQuantity: not a quantity string: ${JSON.stringify(qty)}`);
  const frac = (m[2] ?? "").replace(/0+$/, "");
  return group(m[1]!) + (frac ? `,${frac}` : "");
}

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avqust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const BAKU = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Baku",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface Parts {
  y: string;
  m: string;
  d: string;
  time: string | null;
}

// RFC 3339 with an explicit offset — without one, Date.parse would use the machine's timezone.
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

// A real calendar day: 2026-02-30 or month 13 must not roll over.
function isCalendarDate(y: string, m: string, d: string): boolean {
  const t = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    t.getUTCFullYear() === Number(y) &&
    t.getUTCMonth() === Number(m) - 1 &&
    t.getUTCDate() === Number(d)
  );
}

// Date-only values are calendar dates (no timezone); timestamps are shown on the Baku clock.
function parts(value: string): Parts {
  const invalid = () =>
    new Error(`not an ISO date or timestamp with offset: ${JSON.stringify(value)}`);
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly as unknown as [string, string, string, string];
    if (!isCalendarDate(y, m, d)) throw invalid();
    return { y, m, d, time: null };
  }
  const ts = TIMESTAMP.exec(value);
  const [y, m, d] = (ts?.[1] ?? "").split("-");
  const ms = ts && isCalendarDate(y!, m!, d!) ? Date.parse(value) : NaN;
  if (Number.isNaN(ms)) throw invalid();
  const p = Object.fromEntries(BAKU.formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: p.year!, m: p.month!, d: p.day!, time: `${p.hour}:${p.minute}` };
}

/** `"2026-11-03"` → `"03.11.2026"`. */
export function formatDate(value: string): string {
  const { y, m, d } = parts(value);
  return `${d}.${m}.${y}`;
}

/** `"2026-11-03T05:12:00Z"` → `"03.11.2026, 09:12"` (Baku time). */
export function formatDateTime(value: string): string {
  const p = parts(value);
  return p.time ? `${p.d}.${p.m}.${p.y}, ${p.time}` : `${p.d}.${p.m}.${p.y}`;
}

const bakuDayNumber = (value: string) => {
  const { y, m, d } = parts(value);
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86_400_000;
};

/** Whole calendar days from `from` to `to` on the Baku clock, never negative (problem age). */
export function bakuDaysBetween(from: string, to: string): number {
  return Math.max(0, bakuDayNumber(to) - bakuDayNumber(from));
}

/** `"2026-11-08"` → `"8 noyabr 2026"`. */
export function formatDateLong(value: string): string {
  const { y, m, d } = parts(value);
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
