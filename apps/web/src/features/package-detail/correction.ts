import type { Schemas } from "@payproof/api-client";

type Evidence = Schemas["Evidence"];
const same = (a: Evidence, b: Evidence) =>
  a.document_version_id === b.document_version_id && a.page === b.page && a.quote === b.quote;

/**
 * The extracted field an "edit_field" fix is about: the one its evidence points at; without
 * evidence (e.g. unread lines), the first field still waiting for review. None → nothing to edit.
 */
export function fieldForCheck(pkg: Schemas["PackageDetail"], check: Schemas["CheckResult"]) {
  return (
    pkg.fields.find((f) => f.evidence && check.evidence.some((e) => same(e, f.evidence!))) ??
    pkg.fields.find((f) => f.review_status === "REVIEW_REQUIRED")
  );
}
