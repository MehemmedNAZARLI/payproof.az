// ADR-0011: a requirement set that only has the legacy flags, expressed as document requirements and checks.
// R-001…R-009 keep their ids and their own implementation (engine/); this is only their configuration view.
import type { Schemas } from "@payproof/api-client";
import { ruleTitle, type CheckRuleId } from "@payproof/api-client/i18n";
import registry from "../../../../fixtures/config/document-types.json";
import type { RequirementSet } from "../types";

const LEGACY_RULES: CheckRuleId[] = [
  "R-001", "R-002", "R-003", "R-004", "R-005", "R-006", "R-007", "R-008", "R-009",
]; // prettier-ignore

/** Display name of a registry document type. */
export function documentTypeName(key: string): string {
  const t = registry.find((x) => x.key === key);
  if (!t) throw new Error(`unknown document type ${key}`);
  return t.name;
}

const doc = (type: string, min: number, max: number | null): Schemas["DocumentRequirement"] => ({
  type,
  name: documentTypeName(type),
  min_count: min,
  max_count: max,
});

export function legacyProfile(r: Pick<RequirementSet, "require_delivery">) {
  return {
    documents: [
      doc("invoice", 1, 1),
      doc("order", 0, 1),
      doc("delivery", r.require_delivery ? 1 : 0, 1),
    ],
    checks: LEGACY_RULES.map((id): Schemas["CheckConfig"] => ({
      id,
      type: "legacy_rule",
      title: ruleTitle[id],
      parameters: {},
    })),
    output: null,
  };
}
