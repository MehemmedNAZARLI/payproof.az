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
  nav: {
    label: "Mobil naviqasiya",
    home: "Əsas",
    packages: "Paketlər",
    notifications: "Bildirişlər",
    profile: "Profil",
    back: "Geri",
  },
  common: {
    close: "Bağla",
    loading: "Yüklənir…",
    unread: (n: number) => `${n} oxunmamış`,
  },
} as const;
