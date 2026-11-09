import type { Schemas } from "@payproof/api-client";
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatMoney,
} from "@payproof/api-client/format";
import { cn } from "@/lib/utils";

/**
 * Display only: the amount stays a decimal string, the frontend never computes money. The currency
 * is required — AZN and USD must never look alike.
 */
export function Money({
  amount,
  currency,
  className,
}: {
  amount: string;
  currency: Schemas["Currency"];
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {formatMoney(amount, currency)}
    </span>
  );
}

const formats = { date: formatDate, datetime: formatDateTime, long: formatDateLong };

/** `format`: date `03.11.2026` · datetime `03.11.2026, 09:12` (Baku) · long `8 noyabr 2026`. */
export function DateTime({
  value,
  format = "datetime",
  className,
}: {
  value: string;
  format?: keyof typeof formats;
  className?: string;
}) {
  return (
    <time dateTime={value} className={cn("tabular-nums whitespace-nowrap", className)}>
      {formats[format](value)}
    </time>
  );
}
