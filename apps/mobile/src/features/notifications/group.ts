import type { Schemas } from "@/lib/api";
import { bakuDay, formatDayHeading } from "@/lib/format";

export type DayGroup = { day: string; heading: string; items: Schemas["Notification"][] };

/** Notifications (newest first) under one heading per Baku calendar day. */
export function groupByDay(items: readonly Schemas["Notification"][], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const n of items) {
    const day = bakuDay(new Date(n.created_at));
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(n);
    else groups.push({ day, heading: formatDayHeading(day, now), items: [n] });
  }
  return groups;
}
