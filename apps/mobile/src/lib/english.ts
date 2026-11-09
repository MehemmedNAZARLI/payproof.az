import type { Schemas } from "./api";

// Presentation only. Outcomes, values and verbatim source evidence are never rewritten.
export const ruleTitles: Record<string, string> = {
  "R-001": "Required purchase order number (PO)",
  "R-002": "PO matches the confirmed order",
  "R-003": "Party match",
  "R-004": "Currency and unit match",
  "R-005": "Unit price match",
  "R-006": "Quantity match",
  "R-007": "Required delivery document",
  "R-008": "Signature requirement (human review)",
  "R-009": "Arithmetic totals match",
};
export const checkTitle = (check: Schemas["CheckResult"]) =>
  ruleTitles[check.rule_id] ?? check.rule_id;

const failures: Record<string, string> = {
  "R-001": "The required purchase order number is missing.",
  "R-002": "The purchase order does not match a confirmed order.",
  "R-003": "The parties do not match across the documents.",
  "R-004": "Currency or unit values do not match.",
  "R-005": "Unit prices differ beyond the allowed tolerance.",
  "R-006": "Quantities differ across the documents.",
  "R-007": "The required delivery document is missing.",
  "R-008": "The required signature has not been confirmed by a human.",
  "R-009": "The invoice total does not match its line totals.",
};
export function checkMessage(check: Schemas["CheckResult"]): string {
  if (check.outcome === "PASS") return "This requirement passed the deterministic check. Review the cited source values below.";
  if (check.outcome === "NOT_APPLICABLE") return "This requirement does not apply to this document set.";
  if (check.outcome === "UNKNOWN") return check.cascade
    ? "A related check must be resolved before this result can be determined. Unknown results block approval."
    : "The available evidence is unreadable or insufficient. The result is unknown and blocks approval; no value was guessed.";
  return failures[check.rule_id] ?? "This requirement failed. Review the cited source values below.";
}

const titles: Record<string, string> = {
  "Maliyyə əməkdaşı": "Finance specialist", "Maliyyə direktoru": "Finance director",
  "Anbar və logistika": "Warehouse and logistics", "Satış meneceri": "Sales manager",
  "Daxili auditor": "Internal auditor", "Mühasib": "Accountant",
};
export const jobTitle = (title: string) => titles[title] ?? title;

export const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: "Check the information and try again.",
  UNAUTHENTICATED: "Your session expired. Sign in again.",
  FORBIDDEN: "You do not have permission for this action.",
  NOT_FOUND: "Item not found.",
  VERSION_CONFLICT: "The package changed. Refresh and review the current version.",
  PACKAGE_NOT_READY: "This package is not ready for this action.",
  PACKAGE_NOT_DELETABLE: "An approved package cannot be deleted.",
  TASK_ALREADY_OPEN: "An open task already exists for this rule.",
  TASK_STATUS_NOT_ALLOWED: "This task cannot move to that status.",
  DUPLICATE_FILE: "This file is already in the package.",
  DUPLICATE_INVOICE: "This invoice already exists for this customer.",
  INVOICE_REQUIRED: "An invoice is required for export.",
  IDEMPOTENCY_KEY_REUSED: "This request was already submitted with different information.",
  IDEMPOTENCY_IN_PROGRESS: "This request is still being processed.",
  FILE_TOO_LARGE: "The file exceeds 20 MB.",
  UNSUPPORTED_FILE_TYPE: "Use a PDF, PNG, JPEG, CSV or XLSX file.",
  RATE_LIMITED: "Too many requests. Try again shortly.",
  NETWORK_ERROR: "Could not connect to the server. Check your internet connection.",
  INTERNAL_ERROR: "Something went wrong. Try again shortly.",
};

const notificationPhrases: Record<string, string> = {
  "2 mümkün sifariş tapıldı — seçim tələb olunur.": "2 possible orders found. Select a match.",
  "təsdiqləndi və ixrac gözləyir.": "was approved and is awaiting export.",
  "üzrə qiymət tapşırığını icraya götürdü.": "started the price review task.",
  "fakturada PO yoxdur; PO-381 namizəd kimi tapıldı.": "invoice has no PO; PO-381 was suggested as a match.",
  "təhvil sənədinin yeni versiyası yükləndi.": "a new delivery document version was uploaded.",
  "təsdiqi etibarsızlaşdı —": "approval was invalidated;",
  "yenidən təsdiq tələb edir.": "requires a new approval.",
  "əvvəlki təsdiq etibarsızlaşdı (audit qeydi).": "the previous approval was invalidated (audit record).",
  "təsdiqinizi gözləyir": "is awaiting your approval",
  "bütün yoxlamalardan keçdi və təsdiqçiyə göndərildi.": "passed all checks and was sent for approval.",
  "paketi ixrac edildi": "package was exported",
  "tərəfindən təsdiqləndi — paket göndərilməyə hazırdır.": "approved the package. It is ready to send.",
};
export function notificationText(text: string): string {
  let translated = text;
  for (const [source, english] of Object.entries(notificationPhrases)) translated = translated.replaceAll(source, english);
  // A new server notification must not leak untranslated application copy into the UI.
  return /[əƏıİşŞçÇğĞüÜöÖ]/.test(translated.replace(/^[^:]*:/, ""))
    ? "Package activity updated. Open the package to review its current status."
    : translated;
}
