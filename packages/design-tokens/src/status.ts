// Status → badge tone, as in the prototype's PST / OUT / TST / DST maps. Labels live in @payproof/api-client/i18n.
export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

export const packageStatusTone = {
  PROCESSING: "info",
  NEEDS_REVIEW: "warning",
  NEEDS_FIX: "danger",
  READY_FOR_APPROVAL: "brand",
  APPROVED_READY: "success",
  EXPORTED: "neutral",
} as const satisfies Record<string, Tone>;

export const checkOutcomeTone = {
  PASS: "success",
  FAIL: "danger",
  UNKNOWN: "warning",
  NOT_APPLICABLE: "neutral",
} as const satisfies Record<string, Tone>;

export const taskStatusTone = {
  OPEN: "neutral",
  IN_PROGRESS: "info",
  SUBMITTED_FOR_RECHECK: "warning",
  RESOLVED: "success",
} as const satisfies Record<string, Tone>;

export const documentStatusTone = {
  EXTRACTED: "success",
  REVIEW_REQUIRED: "warning",
  PROCESSING: "info",
  FAILED: "danger",
} as const satisfies Record<string, Tone>;

// Tailwind classes for a badge of each tone (prototype .b-* classes).
export const badgeClass: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
  brand: "bg-brand-50 text-brand-700",
};
