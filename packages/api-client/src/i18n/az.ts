// Azerbaijani UI texts — docs/product/glossary.md and the prototype's label maps (PST, OUT, TST, DST, RULES, CAT, ROLE_L, TYPE_L, PERM_L).
// Each map is keyed by the contract enum, so a new enum value fails typecheck until it gets a label.

import type { components } from "../generated/schema";

type S = components["schemas"];
/** Rules that produce check results; R-010 is the derived overall readiness (no check row). */
export type CheckRuleId =
  "R-001" | "R-002" | "R-003" | "R-004" | "R-005" | "R-006" | "R-007" | "R-008" | "R-009";
export type RuleId = CheckRuleId | "R-010";

export const packageStatusLabel = {
  PROCESSING: "Emal olunur",
  NEEDS_REVIEW: "Yoxlama tələb edir",
  NEEDS_FIX: "Düzəliş tələb edir",
  READY_FOR_APPROVAL: "Təsdiq gözləyir",
  APPROVED_READY: "Göndərilməyə hazır",
  EXPORTED: "İxrac edilib",
} as const satisfies Record<S["PackageStatus"], string>;

export const checkOutcomeLabel = {
  PASS: "Keçdi",
  FAIL: "Uyğunsuz",
  UNKNOWN: "Naməlum",
  NOT_APPLICABLE: "Tətbiq olunmur",
} as const satisfies Record<S["CheckOutcome"], string>;

export const taskStatusLabel = {
  OPEN: "Açıq",
  IN_PROGRESS: "İcrada",
  SUBMITTED_FOR_RECHECK: "Yenidən yoxlamada",
  RESOLVED: "Həll edilib",
} as const satisfies Record<S["TaskStatus"], string>;

export const documentStatusLabel = {
  UPLOADED: "Yükləndi",
  PROCESSING: "Emal olunur",
  EXTRACTED: "Çıxarıldı",
  REVIEW_REQUIRED: "Sahə oxunmadı",
  FAILED: "Emal xətası",
} as const satisfies Record<S["DocumentVersionStatus"], string>;

export const documentTypeLabel = {
  invoice: "Faktura",
  order: "Sifariş",
  delivery: "Təhvil sənədi",
} as const satisfies Record<S["DocumentType"], string>;

export const roleLabel = {
  operator: "Operator",
  approver: "Təsdiqçi",
  readonly: "Yalnız baxış",
  admin: "Admin",
  assignee: "Tapşırıq icraçısı",
} as const satisfies Record<S["Role"], string>;

export const permissionLabel = {
  VIEW: "Paketlərə və sənədlərə baxmaq",
  EDIT_PACKAGE: "Sənəd yükləmək və çıxarışı düzəltmək",
  MANAGE_TASKS: "Tapşırıq yaratmaq",
  MANAGE_REQUIREMENTS: "Müştəri qaydasını təsdiqləmək",
  APPROVE_PACKAGE: "Hazır paketi təsdiqləmək",
  EXPORT_PACKAGE: "Paketi ixrac etmək",
  DELETE_PACKAGE: "Təsdiqlənməmiş paketi silmək",
} as const satisfies Record<S["Permission"], string>;

export const ruleTitle = {
  "R-001": "Məcburi sifariş nömrəsi (PO)",
  "R-002": "PO təsdiqlənmiş sifarişə uyğundur",
  "R-003": "Tərəflərin uyğunluğu",
  "R-004": "Valyuta və vahid uyğunluğu",
  "R-005": "Vahid qiymət uyğunluğu",
  "R-006": "Miqdar uyğunluğu",
  "R-007": "Məcburi təhvil sənədi",
  "R-008": "İmza tələbi (insan yoxlaması)",
  "R-009": "Cəmlərin arifmetik uyğunluğu",
  "R-010": "Ümumi hazırlıq",
} as const satisfies Record<RuleId, string>;

/** Title for a contract `RuleId` (typed as string in the schema); unknown ids are shown as-is. */
export const ruleLabel = (id: string): string => (ruleTitle as Record<string, string>)[id] ?? id;

export const ruleShort = {
  "R-001": "PO çatışmır",
  "R-002": "PO uyğunluğu",
  "R-003": "Tərəf fərqi",
  "R-004": "Valyuta / vahid",
  "R-005": "Qiymət fərqi",
  "R-006": "Miqdar fərqi",
  "R-007": "Təhvil sənədi",
  "R-008": "İmza yoxlaması",
  "R-009": "Cəm fərqi",
} as const satisfies Record<CheckRuleId, string>;

export const ruleCategory = {
  "R-001": "PO istinadı",
  "R-002": "PO istinadı",
  "R-003": "Tərəf uyğunsuzluğu",
  "R-004": "Valyuta / vahid",
  "R-005": "Qiymət / miqdar",
  "R-006": "Qiymət / miqdar",
  "R-007": "Təhvil sənədi",
  "R-008": "Təhvil sənədi",
  "R-009": "Cəm fərqi",
} as const satisfies Record<CheckRuleId, string>;

export const fieldReviewStatusLabel = {
  EXTRACTED: "Çıxarıldı",
  REVIEW_REQUIRED: "Sahə oxunmadı",
  CORRECTED: "Əl ilə düzəldilib",
} as const satisfies Record<S["ExtractedField"]["review_status"], string>;

/** Comparison cell states — "no document" and "not readable" are different things. */
export const comparisonStateLabel = {
  ok: "Uyğundur",
  mismatch: "Uyğunsuz",
  unknown: "Oxunmadı",
  empty: "Sənəd yoxdur",
} as const satisfies Record<S["ComparisonCell"]["state"], string>;

export const jobStatusLabel = {
  QUEUED: "Növbədə",
  RUNNING: "Emal olunur",
  SUCCEEDED: "Hazırdır",
  FAILED: "Emal xətası",
} as const satisfies Record<S["Job"]["status"], string>;

export const linkMethodLabel = {
  exact_id: "Təsdiqlənmiş ID",
  human: "İnsan təsdiqi",
} as const satisfies Record<NonNullable<S["OrderLink"]["method"]>, string>;

/** Action buttons for a check's `fix_hint` (prototype checkCard). */
export const fixHintLabel = {
  link_order: "Sifarişi seç",
  edit_field: "Mənbəyə bax, sahəni düzəlt",
  review_signature: "İmzaya bax və təsdiqlə",
  upload_delivery: "Təhvil sənədi yüklə",
  upload_invoice: "Yeni faktura versiyası",
} as const satisfies Record<NonNullable<S["CheckResult"]["fix_hint"]>, string>;

/** Shown only when the server sent no message (normally `ApiError.message` is used). */
export const errorFallback = {
  VALIDATION_ERROR: "Sorğuda xəta var.",
  TASK_STATUS_NOT_ALLOWED: "Tapşırığın bu statusa keçidi mümkün deyil.",
  INVOICE_REQUIRED: "İxrac paketində faktura məcburidir.",
  IDEMPOTENCY_KEY_REUSED: "Eyni sorğu fərqli məlumatla təkrarlandı.",
  UNAUTHENTICATED: "Sessiya bitib. Yenidən daxil olun.",
  FORBIDDEN: "Bu əməliyyat üçün səlahiyyətiniz yoxdur.",
  NOT_FOUND: "Obyekt tapılmadı.",
  VERSION_CONFLICT: "Paket yenilənib; səhifəni yeniləyin.",
  PACKAGE_NOT_READY: "Paket bu əməliyyat üçün hazır deyil.",
  PACKAGE_NOT_DELETABLE: "Təsdiqlənmiş paket silinə bilməz.",
  TASK_ALREADY_OPEN: "Bu qayda üçün açıq tapşırıq artıq var.",
  DUPLICATE_FILE: "Bu fayl paketdə artıq var — yeni versiya yaradılmadı.",
  DUPLICATE_INVOICE: "Bu faktura bu müştəri üçün artıq mövcuddur.",
  IDEMPOTENCY_IN_PROGRESS: "Eyni sorğu hələ emal olunur.",
  FILE_TOO_LARGE: "Fayl 20 MB-dan böyükdür.",
  UNSUPPORTED_FILE_TYPE: "Yalnız PDF, PNG, JPEG, CSV və XLSX qəbul olunur.",
  RATE_LIMITED: "Çox sorğu göndərildi — bir az sonra yenidən cəhd edin.",
  INTERNAL_ERROR: "Gözlənilməz xəta baş verdi. Bir az sonra yenidən cəhd edin.",
  NETWORK_ERROR: "Serverə qoşulmaq alınmadı. İnternet bağlantısını yoxlayın.",
} as const satisfies Record<S["ErrorCode"] | "NETWORK_ERROR", string>;

/** Common UI texts. */
export const ui = {
  loading: "Yüklənir…",
  retry: "Yenidən cəhd edin",
  errorTitle: "Məlumat yüklənmədi",
  emptyFiltered: "Filtrə uyğun nəticə yoxdur",
  clearFilters: "Filtrləri təmizlə",
  versionConflictTitle: "Paket yenilənib",
  versionConflictBody: "Başqa istifadəçi paketi dəyişib. Ən son versiyaya baxıb yenidən cəhd edin.",
  forbidden: "Bu əməliyyat üçün səlahiyyətiniz yoxdur.",
  approvedTitle: "Paket göndərilməyə hazırdır",
  approvedHint: "Bu, ödəniş zəmanəti deyil — yalnız sənəd hazırlığıdır.",
  problemAmountHint:
    "Bu məbləğ zərər sayılmır. Hər paket bir dəfə sayılır; AZN və USD çevrilmədən ayrıca göstərilir.",
  aiSuggestion: "AI təklifi · insan təsdiqi tələb olunur",
  system: "Sistem",
} as const;

/** Login screen (dev auth: pick a demo user). */
export const loginText = {
  brand: "PayProof",
  tagline: "Faktura paketlərinin hazırlığı və təsdiqi",
  demoBadge: "Sintetik məlumatlarla demo",
  pickTitle: "Demo hesabını seçin",
  submit: "Daxil ol",
  noPasswordHint:
    "Demo rejimində parol tələb olunmur. Real versiyada şirkət hesabı ilə giriş və server tərəfində rol yoxlaması olacaq.",
  signedInAs: (name: string) => `${name} kimi daxil oldunuz.`,
} as const;

/** App shell: skip link, sidebar, top bar and the user menu. */
export const shellText = {
  skipToContent: "Məzmuna keç",
  menu: "Menyu",
  navLabel: "Əsas naviqasiya",
  nav: {
    overview: "İcmal",
    packages: "Faktura paketləri",
    tasks: "Tapşırıqlar",
    rules: "Müştəri qaydaları",
    audit: "Audit tarixçəsi",
  },
  /** Screen-reader label of a nav item with a counter. */
  withOpenCount: (label: string, count: number) => `${label}, ${count} açıq`,
  soonSection: "Tezliklə (P1)",
  soon: { erp: "ERP inteqrasiyası", contracts: "Müqavilə çıxarışı" },
  soonTitle: (label: string) => `${label} — tezliklə`,
  soonToast: (label: string) => `${label} — tezliklə. MVP-yə daxil deyil.`,
  demoNote: "Sintetik məlumatlarla demo. Real bank, e-poçt və ERP əməliyyatı yoxdur.",
  collapse: "Menyunu yığ",
  expand: "Menyunu genişləndir",
  collapseShort: "Yığ",
  expandShort: "Genişləndir",
  openMenu: "Menyunu aç",
  demoTag: "Sintetik demo",
  demoTagTitle: "Bütün məlumatlar sintetikdir",
  searchLabel: "Paket axtar",
  searchPlaceholder: "Faktura, müştəri və ya PO axtar…",
  notifications: "Bildirişlər",
  notificationsSoon: "Bildirişlər tezliklə",
  switchAccount: "Demo hesabına keç",
  signOut: "Çıxış",
} as const;

/** Common button labels. */
export const actionLabel = {
  cancel: "Ləğv et",
  delete: "Sil",
  confirm: "Təsdiqlə",
  close: "Bağla",
  save: "Yadda saxla",
  send: "Göndər",
  back: "Geri",
  refresh: "Yenilə",
} as const;
