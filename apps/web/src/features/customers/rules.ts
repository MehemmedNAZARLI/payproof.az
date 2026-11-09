import type { Schemas } from "@payproof/api-client";

export type Rules = Pick<
  Schemas["RequirementSet"],
  "require_po" | "require_delivery" | "require_signature" | "tolerance"
>;

/**
 * R-009 rounding tolerance as typed ("0,05", "0.5", "1") → the API's decimal string ("0.05"),
 * or null outside 0.00–1.00 / more than two decimals. String arithmetic only: money is never a float.
 */
export function parseTolerance(input: string): string | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const units = Number(m[1]);
  const cents = (m[2] ?? "").padEnd(2, "0");
  if (units > 1 || (units === 1 && cents !== "00")) return null;
  return `${units}.${cents}`;
}

export const sameRules = (a: Rules, b: Rules) =>
  a.require_po === b.require_po &&
  a.require_delivery === b.require_delivery &&
  a.require_signature === b.require_signature &&
  a.tolerance === b.tolerance;
