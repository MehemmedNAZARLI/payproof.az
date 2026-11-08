import type { Schemas } from "@/lib/api";

// What the bottom of the detail screen offers (prototype mPackage `cta`). Whether the user may
// approve or export comes from the server's permissions, never from the role on this device.

export type PackageCta =
  | { kind: "approve" }
  | { kind: "awaiting-approver" }
  | { kind: "blocked"; tone: "danger" | "warning"; rules: string[] }
  | { kind: "export-on-web" }
  | { kind: "ready" }
  | { kind: "exported"; version: number }
  | { kind: "processing" };

type Detail = Pick<Schemas["PackageDetail"], "status" | "version" | "permissions" | "summary">;

export function packageCta(p: Detail): PackageCta {
  switch (p.status) {
    case "READY_FOR_APPROVAL":
      return p.permissions.can_approve ? { kind: "approve" } : { kind: "awaiting-approver" };
    case "NEEDS_FIX":
    case "NEEDS_REVIEW":
      return {
        kind: "blocked",
        tone: p.status === "NEEDS_FIX" ? "danger" : "warning",
        rules: p.summary.blocking.map((b) => b.rule_id),
      };
    case "APPROVED_READY":
      return p.permissions.can_export ? { kind: "export-on-web" } : { kind: "ready" };
    case "EXPORTED":
      return { kind: "exported", version: p.version };
    case "PROCESSING":
      return { kind: "processing" };
  }
}
