import type { Schemas } from "../client";
import { approvalRecord } from "./live";
import { packageDetail } from "./package-detail";
import { addApproval, rememberReplay, replayOf, sessionApprovals } from "./session-db";
import { meFor } from "./store";

// shortcut: POST /v1/packages/{id}/approve over the session db until S-06. Same order of checks
// as the contract: 403 → 409 VERSION_CONFLICT → 200 existing approval → 409 PACKAGE_NOT_READY →
// 200 new approval. An Idempotency-Key replays its first answer; reused for another body → 422.

type ErrorBody = { code: Schemas["ErrorCode"]; message: string; details?: object };
export type ApproveResult =
  | { status: 200; approval: Schemas["ApprovalRecord"] }
  | { status: 403 | 404 | 409 | 422; error: ErrorBody };

type Input = { userSlug: string; packageId: string; key: string | null; body: unknown };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["expected_version", "expected_requirement_set_version", "documents_reviewed"];
const isVersion = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 1;

type Body = { expected_version: number; expected_requirement_set_version: number };

function parse(body: unknown): Body | string {
  if (typeof body !== "object" || body === null) return "body";
  const b = body as Record<string, unknown>;
  const field =
    Object.keys(b).find((k) => !FIELDS.includes(k)) ||
    (!isVersion(b.expected_version) && "expected_version") ||
    (!isVersion(b.expected_requirement_set_version) && "expected_requirement_set_version");
  if (field) return field;
  if (b.documents_reviewed !== true) return "documents_reviewed";
  return b as Body;
}

const invalid = (field: string): ApproveResult => ({
  status: 422,
  error: { code: "VALIDATION_ERROR", message: "Sorğu yanlışdır.", details: { field } },
});

const nowUtc = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function approve({ userSlug, packageId, key, body }: Input): ApproveResult {
  const pkg = packageDetail(packageId, userSlug);
  if (!pkg) return { status: 404, error: { code: "NOT_FOUND", message: "Obyekt tapılmadı." } };
  if (!key || !UUID.test(key)) return invalid("Idempotency-Key");
  const parsed = parse(body);
  if (typeof parsed === "string") return invalid(parsed);

  const fingerprint = JSON.stringify([
    userSlug,
    packageId,
    parsed.expected_version,
    parsed.expected_requirement_set_version,
  ]);
  const replay = replayOf(key);
  if (replay) {
    const first = sessionApprovals().find((a) => a.id === replay.approvalId);
    if (replay.fingerprint !== fingerprint || !first)
      return {
        status: 422,
        error: {
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "Bu açar başqa sorğu üçün istifadə olunub.",
        },
      };
    return { status: 200, approval: approvalRecord(first) };
  }

  if (!meFor(userSlug)?.permissions.includes("APPROVE_PACKAGE"))
    return {
      status: 403,
      error: { code: "FORBIDDEN", message: "Hazır paketi yalnız təsdiqçi rolu təsdiqləyə bilər." },
    };
  if (
    parsed.expected_version !== pkg.version ||
    parsed.expected_requirement_set_version !== pkg.requirement_set.version
  )
    return {
      status: 409,
      error: {
        code: "VERSION_CONFLICT",
        message: "Paket yenilənib. Cari versiyaya yenidən baxın.",
        details: { current_version: pkg.version },
      },
    };
  if (pkg.current_approval) return { status: 200, approval: pkg.current_approval };
  if (pkg.status !== "READY_FOR_APPROVAL")
    return {
      status: 409,
      error: {
        code: "PACKAGE_NOT_READY",
        message: "Bloklayan və ya naməlum yoxlama var — paket təsdiqlənə bilməz.",
        details: { status: pkg.status, blocking: pkg.summary.blocking.map((b) => b.rule_id) },
      },
    };

  const approval = {
    id: `0193a000-0000-7000-8008-9${String(sessionApprovals().length + 1).padStart(11, "0")}`,
    packageId,
    packageVersion: pkg.version,
    requirementSetVersion: pkg.requirement_set.version,
    approverSlug: userSlug,
    approvedAt: nowUtc(),
  };
  addApproval(approval);
  rememberReplay(key, { fingerprint, approvalId: approval.id });
  return { status: 200, approval: approvalRecord(approval) };
}
