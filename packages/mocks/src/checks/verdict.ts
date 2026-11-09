// Shared result helpers for the check library families (ADR-0011).
import { decimal } from "../money";
import type { EvidenceRef, Verdict } from "./types";

export const MONEY = /^-?(0|[1-9][0-9]*)\.[0-9]{2}$/;
export const money = (c: number, currency: string) => ({ amount: decimal(c), currency });
export const fmt = (c: number, currency: string) => `${decimal(c)} ${currency}`;
export const NA = (message: string): Verdict => ({
  outcome: "NOT_APPLICABLE",
  message,
  evidence: [],
});
export const verdict = (
  outcome: Verdict["outcome"],
  message: string,
  evidence: EvidenceRef[],
  data: Record<string, unknown>,
): Verdict => ({ outcome, message, evidence, data });
