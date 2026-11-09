import type { Schemas } from "@payproof/api-client";

type RuleId = Schemas["RuleId"];

const BAKU = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" });

/** "YYYY-MM-DD" on the Baku clock — due dates are company calendar days. */
export const bakuToday = (now = new Date()) => BAKU.format(now);

/** Calendar arithmetic on "YYYY-MM-DD" (UTC noon: no DST or offset can shift the day). */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Shown next to the due date; a resolved task is never late. */
export function dueState(
  due: string,
  status: Schemas["TaskStatus"],
  now = new Date(),
): "overdue" | "today" | null {
  if (status === "RESOLVED") return null;
  const today = bakuToday(now);
  return due < today ? "overdue" : due === today ? "today" : null;
}

// shortcut: templates live in the UI (prototype STEP_T) until the API offers them
const STEPS: Record<RuleId, (po: string) => string> = {
  "R-001": (po) =>
    `Fakturaya müştərinin sifariş nömrəsini (${po}) mənbə sistemində əlavə edin və düzəldilmiş faktura versiyasını yükləyin.`,
  "R-002": (po) =>
    `Fakturadakı sifariş nömrəsini təsdiqlənmiş sifarişə (${po}) uyğun düzəldin və yeni versiyanı yükləyin.`,
  "R-003": () => "Bu alıcıya aid düzgün təhvil sənədini tapın və paketə yükləyin.",
  "R-004": () =>
    "Müştəri ilə fakturanın valyutasını dəqiqləşdirin; lazım olarsa fakturanı sifarişin valyutasında yenidən tərtib edin.",
  "R-005": () => "Aktual qiymət razılaşmasını yoxlayın və düzgün qiyməti təsdiqləyin.",
  "R-006": () => "Faktiki təhvil miqdarını anbar qeydləri ilə tutuşdurub təsdiqləyin.",
  "R-007": () => "Müştərinin tələb etdiyi təhvil-təslim aktını paketə yükləyin.",
  "R-008": () => "Təhvil aktında imzanın mövcudluğunu sənədə baxaraq təsdiqləyin.",
  "R-009": () => "Fakturada sətir cəmləri ilə yekun məbləği uyğunlaşdırın.",
  "R-010": () => "Bloklayan yoxlamaları həll edin.",
};

export const stepTemplate = (rule: RuleId, po: string | null) => STEPS[rule]?.(po ?? "PO") ?? "";

// shortcut: departments by job title (prototype DEF_WHO); a real org model would carry them
const DEPARTMENT: Partial<Record<RuleId, string>> = {
  "R-001": "Mühasib",
  "R-002": "Mühasib",
  "R-009": "Mühasib",
  "R-004": "Satış meneceri",
  "R-005": "Satış meneceri",
  "R-003": "Anbar və logistika",
  "R-006": "Anbar və logistika",
  "R-007": "Anbar və logistika",
  "R-008": "Anbar və logistika",
};

/** The usual owner of a rule's fix; "" when nobody fits — the user chooses. */
export function defaultAssignee(rule: RuleId, users: { id: string; title: string | null }[]) {
  return users.find((u) => u.title === DEPARTMENT[rule])?.id ?? "";
}
