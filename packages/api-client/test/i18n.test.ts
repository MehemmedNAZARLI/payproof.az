import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as az from "../src/i18n/az";

const prototype = readFileSync(
  new URL("../../../docs/product/prototype/payproof-prototype.html", import.meta.url),
  "utf8",
);
const glossary = readFileSync(
  new URL("../../../docs/product/glossary.md", import.meta.url),
  "utf8",
);
// Evaluates `const NAME = { … };` from the prototype (trusted repo file, plain object literal).
const literal = (name: string): Record<string, unknown> => {
  const start = prototype.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`${name} not found in prototype`);
  const open = prototype.indexOf("{", start);
  const end = prototype.indexOf("};", open);
  return new Function(`return (${prototype.slice(open, end + 1)});`)() as Record<string, unknown>;
};
const labels = (name: string, key = "l") =>
  Object.fromEntries(
    Object.entries(literal(name)).map(([k, v]) => [k, (v as Record<string, string>)[key]]),
  );

describe("az labels match the prototype", () => {
  it("package statuses", () => expect(az.packageStatusLabel).toEqual(labels("PST")));
  it("check outcomes", () => expect(az.checkOutcomeLabel).toEqual(labels("OUT")));
  it("task statuses", () => expect(az.taskStatusLabel).toEqual(labels("TST")));
  it("document version statuses (+ UPLOADED from the glossary)", () =>
    expect(az.documentStatusLabel).toEqual({ ...labels("DST"), UPLOADED: "Yükləndi" }));
  it("document types", () => expect(az.documentTypeLabel).toEqual(literal("TYPE_L")));
  it("rule titles (+ R-010 from the glossary), short names and categories", () => {
    expect(az.ruleTitle).toEqual({ ...labels("RULES", "t"), "R-010": "Ümumi hazırlıq" });
    expect(az.ruleShort).toEqual(labels("RULES", "s"));
    expect(az.ruleCategory).toEqual(literal("CAT"));
  });
  it("ruleLabel accepts any contract rule id and falls back to the id", () => {
    expect(az.ruleLabel("R-005")).toBe("Vahid qiymət uyğunluğu");
    expect(az.ruleLabel("R-099")).toBe("R-099");
  });
  it("signed-in roles keep the prototype names", () => {
    const proto = literal("ROLE_L");
    for (const role of ["operator", "approver", "readonly"] as const)
      expect(az.roleLabel[role]).toBe(proto[role]);
  });
  it("admin and assignee use the glossary names", () => {
    expect(glossary).toContain(`| \`admin\` | ${az.roleLabel.admin}`);
    expect(glossary).toContain(`| \`assignee\` | ${az.roleLabel.assignee} |`);
  });
  it("permissions reuse the prototype PERM_L wording", () => {
    const p = literal("PERM_L") as Record<string, string>;
    expect(az.permissionLabel).toMatchObject({
      MANAGE_TASKS: p.task,
      MANAGE_REQUIREMENTS: p.rules,
      APPROVE_PACKAGE: p.approve,
      EXPORT_PACKAGE: p.export,
      DELETE_PACKAGE: p.del,
    });
    expect(az.permissionLabel.EDIT_PACKAGE).toBe(`${p.upload} və ${p.edit!.toLowerCase()}`);
  });
  it("fix hints are the prototype's action button texts", () => {
    for (const text of Object.values(az.fixHintLabel))
      expect(prototype).toContain(`${text}</button>`);
  });
  it("labels every UI-visible contract enum", () => {
    expect(Object.keys(az.fieldReviewStatusLabel).sort()).toEqual([
      "CORRECTED",
      "EXTRACTED",
      "REVIEW_REQUIRED",
    ]);
    expect(Object.keys(az.comparisonStateLabel).sort()).toEqual([
      "empty",
      "mismatch",
      "ok",
      "unknown",
    ]);
    expect(Object.keys(az.jobStatusLabel).sort()).toEqual([
      "FAILED",
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
    ]);
    expect(Object.keys(az.linkMethodLabel).sort()).toEqual(["exact_id", "human"]);
    expect(az.errorFallback.NETWORK_ERROR).toBeTruthy();
  });
});

describe("az texts", () => {
  const all = JSON.stringify(az);
  it("never says the package is paid in the new UI texts either", () =>
    expect(JSON.stringify([az.loginText, az.shellText, az.actionLabel])).not.toMatch(/ödən/i));
  it.each([
    "Ödəniş təmin edildi",
    "Faktura ödənildi",
    "Fraud aşkarlandı",
    "AI hər şeyi yoxladı",
    "Maliyyə itkisi",
  ])("never says %j", (phrase) => expect(all.toLowerCase()).not.toContain(phrase.toLowerCase()));
  it("says the package is ready to send, not paid", () => {
    expect(az.ui.approvedTitle).toBe("Paket göndərilməyə hazırdır");
  });
});

describe("login, shell and action texts", () => {
  const strings = (o: object): string[] =>
    Object.values(o).flatMap((v) =>
      typeof v === "string" ? [v] : typeof v === "object" && v ? strings(v) : [],
    );
  // Written for the web app (a11y labels, the dev-login hint) — not in the prototype.
  const webOnly = new Set([
    "Demo rejimində parol tələb olunmur. Real versiyada şirkət hesabı ilə giriş və server tərəfində rol yoxlaması olacaq.",
    "Məzmuna keç",
    "Menyu",
    "Əsas naviqasiya",
    "Menyunu genişləndir",
    "Menyunu aç",
    "Yığ",
    "Genişləndir",
    "Paket axtar",
    "Bildirişlər tezliklə",
    "Çıxış",
    "Sil",
    "Yadda saxla",
    "Yenilə",
  ]);
  const flat = (s: string) => s.replace(/…$/, "");

  it.each(strings({ ...az.loginText, ...az.shellText, ...az.actionLabel }).map((s) => [s]))(
    "%j comes from the prototype or is a known web text",
    (s) => {
      expect(s.trim()).not.toBe("");
      if (!webOnly.has(s)) expect(prototype).toContain(flat(s));
    },
  );

  it("formats the texts that carry a value", () => {
    expect(az.loginText.signedInAs("Rəşad Əliyev")).toBe("Rəşad Əliyev kimi daxil oldunuz.");
    expect(az.shellText.withOpenCount("Tapşırıqlar", 6)).toBe("Tapşırıqlar, 6 açıq");
    expect(az.shellText.soonTitle("ERP inteqrasiyası")).toBe("ERP inteqrasiyası — tezliklə");
    expect(az.shellText.soonToast("ERP inteqrasiyası")).toBe(
      "ERP inteqrasiyası — tezliklə. MVP-yə daxil deyil.",
    );
  });
});
