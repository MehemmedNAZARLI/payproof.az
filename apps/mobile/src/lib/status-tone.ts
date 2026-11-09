// Status → tone for badges. Mobile owns its palette, so these maps live here, not in the shared
// tokens package. One accent: "in progress" and "waiting for you" both use it; neutral is grey.
export type Tone = "success" | "warning" | "danger" | "accent" | "neutral";

export const packageStatusTone = {
  PROCESSING: "neutral",
  NEEDS_REVIEW: "warning",
  NEEDS_FIX: "danger",
  READY_FOR_APPROVAL: "accent",
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
  IN_PROGRESS: "accent",
  SUBMITTED_FOR_RECHECK: "warning",
  RESOLVED: "success",
} as const satisfies Record<string, Tone>;

// Tinted ground + ink text: every pair keeps 4.5:1 in both themes (status-tone.test.ts).
export const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  accent: "bg-accent-soft text-accent-ink",
  neutral: "bg-neutral-soft text-neutral-ink",
};
