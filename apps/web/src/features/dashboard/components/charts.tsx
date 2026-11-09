import type { Schemas } from "@payproof/api-client";
import { packageStatusLabel, ruleLabel, ruleShort } from "@payproof/api-client/i18n";
import Link from "next/link";
import { Panel } from "@/components/ui/layout";

type Dashboard = Schemas["Dashboard"];
type Status = Schemas["PackageStatus"];

/** Problem types per rule (prototype `.bars`): FAIL and UNKNOWN stacked, counts as text. */
export function RuleBars({ counts }: { counts: Dashboard["rule_counts"] }) {
  const rows = [...counts].sort((a, b) => b.fail + b.unknown - (a.fail + a.unknown));
  const max = Math.max(1, ...rows.map((r) => r.fail + r.unknown));
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <Panel
      title="Problem növləri (qayda üzrə)"
      actions={<span className="text-text-3 text-xs">ixrac edilməmiş paketlər</span>}
    >
      {rows.length ? (
        <ul className="flex flex-col gap-2.5">
          {rows.map(({ rule_id, fail, unknown }) => (
            <li
              key={rule_id}
              className="grid grid-cols-[130px_1fr_32px] items-center gap-2.5 text-sm"
            >
              <span className="truncate" title={ruleLabel(rule_id)}>
                <span className="text-text-3 font-mono text-xs">{rule_id}</span>{" "}
                {ruleShort[rule_id as keyof typeof ruleShort] ?? ""}
              </span>
              <span
                aria-hidden="true"
                className="bg-surface-2 flex h-3.5 overflow-hidden rounded-full"
              >
                <i className="bg-danger block h-full" style={{ width: pct(fail) }} />
                <i className="bg-warning block h-full" style={{ width: pct(unknown) }} />
              </span>
              <b className="text-right tabular-nums">{fail + unknown}</b>
              <span className="sr-only">{`${fail} uyğunsuz, ${unknown} naməlum`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-2">Açıq problem yoxdur.</p>
      )}
      <div className="text-text-2 mt-3 flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="bg-danger size-2.5 rounded-[3px]" />
          Uyğunsuz (FAIL)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="bg-warning size-2.5 rounded-[3px]" />
          Naməlum (UNKNOWN)
        </span>
      </div>
    </Panel>
  );
}

// Prototype PST_ORDER / PST_COLOR: problems first.
const ORDER: [Status, string][] = [
  ["NEEDS_FIX", "var(--danger)"],
  ["NEEDS_REVIEW", "var(--warning)"],
  ["PROCESSING", "var(--info)"],
  ["READY_FOR_APPROVAL", "var(--brand-600)"],
  ["APPROVED_READY", "var(--success)"],
  ["EXPORTED", "var(--border-strong)"],
];

/** Packages by status (prototype `.donut`); the legend doubles as the text alternative and filter. */
export function StatusDonut({
  counts,
  total,
}: {
  counts: Dashboard["status_counts"];
  total: number;
}) {
  const shares = ORDER.map(([s]) => (total ? (counts[s] / total) * 100 : 0));
  // each segment starts where the previous ones end (12 o'clock = offset 25)
  const segments = ORDER.map(([s, color], i) => ({
    s,
    color,
    dash: Math.max(0, shares[i]! - 0.8), // small gap between segments
    offset: 25 - shares.slice(0, i).reduce((a, b) => a + b, 0),
  })).filter(({ s }) => counts[s] > 0);
  const label = `Status bölgüsü, ${total} paket: ${ORDER.map(([s]) => `${packageStatusLabel[s]} ${counts[s]}`).join(", ")}`;
  return (
    <Panel title="Paketlər statusa görə">
      <div className="flex flex-wrap items-center gap-5">
        <svg viewBox="0 0 42 42" role="img" aria-label={label} className="size-[168px] shrink-0">
          <circle
            r="15.915"
            cx="21"
            cy="21"
            fill="none"
            strokeWidth="5.2"
            stroke="var(--surface-2)"
          />
          {segments.map(({ s, color, dash, offset }) => (
            <circle
              key={s}
              r="15.915"
              cx="21"
              cy="21"
              fill="none"
              strokeWidth="5.2"
              stroke={color}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={offset}
            />
          ))}
          <text x="21" y="21" textAnchor="middle" fontSize="7" fontWeight="800" fill="var(--text)">
            {total}
          </text>
          <text x="21" y="27" textAnchor="middle" fontSize="3" fill="var(--text-3)">
            paket
          </text>
        </svg>
        <ul className="flex min-w-[190px] flex-1 flex-col gap-0.5">
          {ORDER.map(([s, color]) => (
            <li key={s}>
              <Link
                href={`/packages?status=${s}`}
                className="hover:bg-surface-2 focus-visible:ring-ring flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-sm outline-none focus-visible:ring-2 pointer-coarse:min-h-11"
              >
                <i aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color }} />
                {packageStatusLabel[s]}
                <span className="ml-auto font-bold tabular-nums">{counts[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
