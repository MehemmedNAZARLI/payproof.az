import customers from "@fixtures/customers.json";
import expected from "@fixtures/expected.json";
import packages from "@fixtures/packages.json";
import tasks from "@fixtures/tasks.json";

import type { Schemas } from "../client";
import { mockUuid, toUtc, userRef } from "./store";

// shortcut: the audit trail the prototype's reset() derives from the fixtures (fixtures/README:
// history is derived data), until S-06 brings the shared mock store.

type Event = Schemas["AuditEvent"];
type FixturePackage = (typeof packages)[number];

const DOC_LABEL: Record<string, string> = {
  invoice: "Faktura",
  order: "Sifariş",
  delivery: "Təhvil sənədi",
};
const MIN_MS = 60_000;
const plusMinutes = (iso: string, m: number) =>
  new Date(Date.parse(iso) + m * MIN_MS).toISOString();
const actor = (slug: string | null) => (slug === null || slug === "system" ? null : userRef(slug));

function checksSummary(f: FixturePackage): string {
  const golden = expected.packages[f.invoice_number as keyof typeof expected.packages];
  const n = (o: string) => Object.values(golden.checks).filter((c) => c === o).length;
  return `${n("PASS")} keçdi, ${n("FAIL")} uyğunsuz, ${n("UNKNOWN")} naməlum, ${n("NOT_APPLICABLE")} tətbiq olunmur`;
}

function packageEvents(f: FixturePackage) {
  const customer = customers.find((c) => c.id === f.customer_id)?.name ?? "";
  const rules =
    expected.packages[f.invoice_number as keyof typeof expected.packages].requirement_set_version;
  const out: [string, string | null, string, string][] = [
    [f.created_at, f.owner_id, "package.created", `${f.invoice_number} · ${customer}`],
  ];
  for (const d of f.documents)
    for (const v of d.versions)
      out.push([
        v.uploaded_at,
        v.uploaded_by,
        "document.uploaded",
        `${DOC_LABEL[d.type]}: ${v.file_name} (sənəd v${v.version_no})`,
      ]);
  if (f.processing) return out;
  const unreadable = f.invoice.unreadable_fields.length > 0;
  out.push([
    plusMinutes(f.created_at, 2),
    null,
    "extraction.completed",
    unreadable
      ? "Skan: PO sahəsi oxunmadı — insan yoxlaması tələb olunur"
      : "Sahələr və mənbə istinadları çıxarıldı",
  ]);
  const link = f.order_link;
  if (link.confirmed) {
    const human = link.confirmed_by !== "system";
    out.push([
      plusMinutes(f.created_at, 4),
      link.confirmed_by,
      "order.linked",
      `${link.po_number} · üsul: ${human ? "insan təsdiqi" : "təsdiqlənmiş ID"}`,
    ]);
  } else if (f.candidates.length)
    out.push([
      plusMinutes(f.created_at, 3),
      null,
      "order.candidates_found",
      `${f.candidates.map((c) => c.po_number).join(", ")} — insan seçimi gözlənilir`,
    ]);
  for (const a of f.approvals) {
    out.push([
      a.created_at,
      a.approver_id,
      "package.approved",
      `v${a.package_version} · qayda dəsti v${a.requirement_set_version}`,
    ]);
    if (a.invalidated_at)
      out.push([
        a.invalidated_at,
        null,
        "approval.invalidated",
        `v${a.package_version} təsdiqi qüvvədən düşdü: ${a.invalidated_reason?.toLowerCase() ?? ""}. Əvvəlki təsdiq auditdə saxlanılır.`,
      ]);
  }
  for (const e of f.exports)
    out.push([
      e.created_at,
      e.created_by,
      "package.exported",
      `v${e.package_version} · manifest: ${e.files.join(", ")}`,
    ]);
  const checkedAt =
    f.exports[0]?.created_at ?? f.approvals[0]?.created_at ?? plusMinutes(f.created_at, 6);
  out.push([
    plusMinutes(checkedAt, -3),
    null,
    "validation.completed",
    `v${f.version} · qayda dəsti v${rules} · ${checksSummary(f)}`,
  ]);
  return out;
}

function build(): Event[] {
  const raw: {
    at: string;
    actor: string | null;
    action: string;
    message: string;
    f: FixturePackage;
  }[] = [];
  for (const f of packages)
    for (const [at, who, action, message] of packageEvents(f))
      raw.push({ at, actor: who, action, message, f });
  for (const t of tasks) {
    const f = packages.find((p) => p.id === t.package_id);
    if (!f) continue;
    const assignee = userRef(t.assignee_id).full_name;
    raw.push({
      at: t.created_at,
      actor: t.created_by,
      action: "task.created",
      message: `${t.number} · ${t.rule_id} · məsul: ${assignee}`,
      f,
    });
    if (t.resolved_at)
      raw.push({
        at: t.resolved_at,
        actor: null,
        action: "task.resolved",
        message: `${t.number}: ${t.rule_id} yoxlaması keçdi`,
        f,
      });
  }
  return raw
    .map((e, i) => ({ ...e, at: toUtc(e.at), seq: i }))
    .sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq)
    .map((e) => ({
      id: `0193a000-0000-7000-800a-${(e.seq + 1).toString().padStart(12, "0")}`,
      created_at: e.at,
      actor: actor(e.actor),
      action: e.action,
      message: e.message,
      package: { id: mockUuid("package", e.f.id), invoice_number: e.f.invoice_number },
      package_version: e.f.version,
      object_type: e.action.split(".")[0] ?? "package",
      object_id: null,
      details: {},
    }));
}

/** The company audit log, newest first. */
export const auditLog: readonly Event[] = build();
