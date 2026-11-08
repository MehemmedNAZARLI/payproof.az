import type { checkOutcomeTone, packageStatusTone, taskStatusTone } from "@payproof/design-tokens";

export type PackageStatus = keyof typeof packageStatusTone;
export type CheckOutcome = keyof typeof checkOutcomeTone;
export type TaskStatus = keyof typeof taskStatusTone;

// shortcut: labels mirror the prototype (PST/OUT/TST) until @payproof/api-client/i18n (S-05)
// exists; then this file re-exports from there and the call sites stay the same.
export const t = {
  package: {
    status: {
      PROCESSING: "Emal olunur",
      NEEDS_REVIEW: "Yoxlama tələb edir",
      NEEDS_FIX: "Düzəliş tələb edir",
      READY_FOR_APPROVAL: "Təsdiq gözləyir",
      APPROVED_READY: "Göndərilməyə hazır",
      EXPORTED: "İxrac edilib",
    } satisfies Record<PackageStatus, string>,
  },
  role: {
    operator: "Operator",
    approver: "Təsdiqçi",
    readonly: "Yalnız baxış",
    admin: "Admin",
    assignee: "Tapşırıq icraçısı",
  },
  packageFilter: {
    label: "Status filtri",
    all: "Hamısı",
    ready: "Təsdiq gözləyir",
    problem: "Problemli",
    approved: "Hazır",
    exported: "İxrac edilib",
  },
  packageItem: {
    processing: "Faktura oxunur…",
    blocking: (n: number) => `${n} bloklayan`,
  },
  check: {
    outcome: {
      PASS: "Keçdi",
      FAIL: "Uyğunsuz",
      UNKNOWN: "Naməlum",
      NOT_APPLICABLE: "Tətbiq olunmur",
    } satisfies Record<CheckOutcome, string>,
  },
  task: {
    status: {
      OPEN: "Açıq",
      IN_PROGRESS: "İcrada",
      SUBMITTED_FOR_RECHECK: "Yenidən yoxlamada",
      RESOLVED: "Həll edilib",
    } satisfies Record<TaskStatus, string>,
  },
  auth: {
    demoBadge: "Sintetik məlumatlarla demo",
    pickTitle: "Demo hesabını seçin",
    pickHint: "Bir toxunuşla daxil olun — parol lazım deyil.",
    recommended: "Tövsiyə olunur",
    signingIn: "Daxil olunur…",
    signedIn: (name: string) => `${name} kimi daxil oldunuz.`,
    footnote:
      "Demoda parol tələb olunmur. Real versiyada şirkət hesabı ilə giriş olacaq; rol və səlahiyyətlər serverdə yoxlanılır.",
    unavailable: "Demo giriş əlçatan deyil",
    expired: "Sessiya bitib. Yenidən daxil olun.",
  },
  home: {
    awaitingYou: "Təsdiqinizi gözləyir",
    awaitingApprover: "Təsdiqçini gözləyir",
    packages: (n: number) => `${n} paket`,
    packageUnit: "paket",
    openAmount: "Açıq problemli məbləğ",
    notLoss: "İtki deyil; valyutalar çevrilmədən ayrıca göstərilir.",
    noOpen: "Açıq problem yoxdur.",
    pending: "Təsdiq gözləyənlər",
    all: "Hamısı",
    pendingEmpty: "Təsdiq gözləyən paket yoxdur",
    pendingEmptyHint: "Bütün məcburi yoxlamalardan keçən paketlər burada görünəcək.",
    activity: "Son fəaliyyət",
    activityEmpty: "Hələ fəaliyyət yoxdur",
    system: "Sistem",
    loadFailed: "İcmal yüklənmədi",
    summary: "Statuslar",
  },
  audit: {
    action: {
      "package.created": "Paket yaradıldı",
      "document.uploaded": "Sənəd yükləndi",
      "extraction.completed": "Məlumat çıxarıldı",
      "order.linked": "Sifariş əlaqələndirildi",
      "order.candidates_found": "Sifariş namizədləri tapıldı",
      "package.approved": "Paket təsdiqləndi",
      "approval.invalidated": "Təsdiq etibarsızlaşdı",
      "package.exported": "Paket ixrac edildi",
      "task.created": "Tapşırıq yaradıldı",
      "task.resolved": "Tapşırıq həll edildi",
      "validation.completed": "Yoxlama aparıldı",
    } as Record<string, string>,
  },
  permission: {
    VIEW: "Paketlərə baxmaq",
    EDIT_PACKAGE: "Sənəd yükləmək, düzəliş etmək",
    MANAGE_TASKS: "Tapşırıq yaratmaq",
    MANAGE_REQUIREMENTS: "Müştəri qaydasını təsdiqləmək",
    APPROVE_PACKAGE: "Hazır paketi təsdiqləmək",
    EXPORT_PACKAGE: "Paketi ixrac etmək",
    DELETE_PACKAGE: "Təsdiqlənməmiş paketi silmək",
  },
  profile: {
    title: "Profil",
    permissions: "Səlahiyyətlər",
    yes: "Bəli",
    no: "Xeyr",
    settings: "Tənzimləmələr",
    language: "Dil",
    languageValue: "Azərbaycan dili",
    languageSoon: "Digər dillər — tezliklə",
    push: "Push bildirişləri",
    pushValue: "P2",
    pushSoon: "Push bildirişləri — tezliklə. MVP-yə daxil deyil.",
    appearance: "Görünüş",
    appearanceValue: "Sistem",
    web: "Veb tətbiqə keç",
    signOut: "Hesabdan çıx",
    signOutTitle: "Hesabdan çıxılsın?",
    signOutBody:
      "Bu cihazda saxlanılan paket məlumatları silinəcək. Yenidən daxil olmaq bir toxunuş çəkir.",
    cancel: "Ləğv et",
    footnote:
      "PayProof MVP · sintetik demo məlumatları · real ödəniş, e-poçt və ERP əməliyyatı yoxdur",
    loadFailed: "Profil yüklənmədi",
  },
  nav: {
    label: "Mobil naviqasiya",
    home: "Əsas",
    packages: "Paketlər",
    notifications: "Bildirişlər",
    profile: "Profil",
    back: "Geri",
  },
  errors: {
    network: "İnternet bağlantısı yoxdur. Bağlantını yoxlayıb yenidən cəhd edin.",
    unexpected: "Gözlənilməz xəta baş verdi. Bir az sonra yenidən cəhd edin.",
    refreshFailed: "Məlumat yenilənmədi",
    loadFailed: "Məlumat yüklənmədi",
    offline: "İnternet bağlantısı yoxdur",
    offlineHint: "Bağlantı bərpa olunanda siyahı özü yüklənəcək.",
  },
  common: {
    close: "Bağla",
    dismiss: "Bildirişi bağla",
    loading: "Yüklənir…",
    retry: "Yenidən cəhd et",
    refresh: "Yenilə",
    empty: "Heç nə tapılmadı",
    unread: (n: number) => `${n} oxunmamış`,
    notificationsUnread: (n: number) => `Bildirişlər, ${n} oxunmamış`,
  },
} as const;
