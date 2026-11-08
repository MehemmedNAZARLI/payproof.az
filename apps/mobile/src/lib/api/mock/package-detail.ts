import packages from "@fixtures/packages.json";

import type { Schemas } from "../client";
import { link, packageTasks, permissions, requirementSet, uuid } from "./detail-parts";
import { mockDocuments } from "./documents";
import { type RuleId, runChecks } from "./engine/checks";
import { packageModel } from "./engine/model";
import { meFor, mockUuid, packageList, toUtc, userRef } from "./store";

type Detail = Schemas["PackageDetail"];

// shortcut: GET /v1/packages/{id} built from fixtures until S-06. `fields` and `comparison`
// feed the web's comparison table and stay empty here; the mobile app does not read them.

const RULE_TITLES: Record<RuleId, string> = {
  "R-001": "Məcburi sifariş nömrəsi (PO)",
  "R-002": "PO təsdiqlənmiş sifarişə uyğundur",
  "R-003": "Tərəflərin uyğunluğu",
  "R-004": "Valyuta və vahid uyğunluğu",
  "R-005": "Vahid qiymət uyğunluğu",
  "R-006": "Miqdar uyğunluğu",
  "R-007": "Məcburi təhvil sənədi",
  "R-008": "İmza tələbi (insan yoxlaması)",
  "R-009": "Cəmlərin arifmetik uyğunluğu",
};

export function packageDetail(packageId: string, userSlug: string): Detail | undefined {
  const item = packageList.find((x) => x.id === packageId);
  const p = packages.find((x) => mockUuid("package", x.id) === packageId);
  const user = meFor(userSlug);
  if (!item || !p || !user) return undefined;
  const m = packageModel(p);
  const docs = mockDocuments(p);
  const ref = { id: item.id, invoice_number: item.invoice_number ?? "" };
  const checks = p.processing ? [] : runChecks(m);
  const approvals = p.approvals.map((a, i) => ({
    id: uuid("8008", `${p.id.replace(/\D/g, "")}${String(i + 1).padStart(4, "0")}`),
    package_version: a.package_version,
    requirement_set_version: a.requirement_set_version,
    approver: userRef(a.approver_id),
    approved_at: toUtc(a.created_at),
    valid: a.valid,
    invalidated_reason: a.invalidated_reason,
    invalidated_at: a.invalidated_at && toUtc(a.invalidated_at),
  }));
  const count = (o: Schemas["CheckOutcome"]) => checks.filter((c) => c.outcome === o).length;
  return {
    id: item.id,
    invoice_number: item.invoice_number,
    version: item.version,
    status: item.status,
    processing: p.processing,
    customer: item.customer,
    invoice_date: item.invoice_date,
    owner: item.owner,
    updated_at: item.updated_at,
    total: item.total,
    created_at: toUtc(p.created_at),
    requirement_set: requirementSet(p, m.rules.version),
    link: link(p),
    documents: docs.documents,
    fields: [],
    comparison: { rows: [] },
    checks: checks.map((c) => ({
      rule_id: c.ruleId,
      title: RULE_TITLES[c.ruleId],
      outcome: c.outcome,
      cascade: c.cascade,
      message: c.message,
      evidence: c.evidence.map((e) => ({
        document_version_id: docs.currentVersionId[e.doc]!,
        page: 1,
        quote: e.quote,
        bbox: null,
      })),
      fix_hint: c.fixHint,
      data: c.data,
    })),
    summary: {
      pass: count("PASS"),
      fail: count("FAIL"),
      unknown: count("UNKNOWN"),
      not_applicable: count("NOT_APPLICABLE"),
      blocking: item.blocking,
    },
    current_approval:
      approvals.find(
        (a) =>
          a.valid &&
          a.package_version === p.version &&
          a.requirement_set_version === m.rules.version,
      ) ?? null,
    approvals,
    exports: p.exports.map((e, i) => ({
      id: uuid("8009", `${p.id.replace(/\D/g, "")}${String(i + 1).padStart(4, "0")}`),
      package_version: e.package_version,
      requirement_set_version: e.requirement_set_version,
      created_by: userRef(e.created_by),
      created_at: toUtc(e.created_at),
      files: e.files.map((name) => ({
        document_version_id: docs.versionIdByFile.get(name)!,
        type: p.documents.find((d) => d.versions.some((v) => v.file_name === name))!
          .type as Schemas["DocumentType"],
        file_name: name,
      })),
    })),
    tasks: packageTasks(p, ref),
    permissions: permissions(item.status, approvals.length > 0, user),
  };
}
