// Fixture slugs ↔ the readable UUIDs used in the contract examples: 0193a000-0000-7000-80TT-<12 digits>.
// TT = object type, so an id tells what it points at when debugging.

const PREFIX = "0193a000-0000-7000-80";
const make = (tt: string, digits: string | number) =>
  `${PREFIX}${tt}-${String(digits).padStart(12, "0")}`;
const num = (slug: string) => slug.replace(/\D/g, "");
const DOC_TYPE = { invoice: 1, order: 2, delivery: 3 } as const;
export type DocType = keyof typeof DOC_TYPE;

export const id = {
  company: () => make("00", "c0a1"),
  user: (u: string) => make("00", num(u)),
  customer: (c: string) => make("01", num(c)),
  pkg: (p: string) => make("02", num(p)),
  order: (po: string) => make("03", num(po)),
  document: (p: string, type: DocType) =>
    make("04", `0000${num(p).padStart(4, "0")}000${DOC_TYPE[type]}`),
  version: (p: string, type: DocType, v: number) =>
    make("05", `0000${num(p).padStart(4, "0")}${DOC_TYPE[type]}${String(v).padStart(3, "0")}`),
  task: (t: string) => make("06", num(t)),
  job: (seq: number) => make("07", seq),
  approval: (p: string, v: number) =>
    make("08", `0000${num(p).padStart(4, "0")}${String(v).padStart(4, "0")}`),
  export: (p: string, v: number) =>
    make("09", `0000${num(p).padStart(4, "0")}${String(v).padStart(4, "0")}`),
  audit: (seq: number) => make("0a", seq),
  notification: (seq: number) => make("0b", seq),
  field: (p: string, type: DocType, n: number) =>
    make("0c", `0000${num(p).padStart(4, "0")}${DOC_TYPE[type]}${String(n).padStart(3, "0")}`),
  ruleSet: (c: string, v: number) => make("0d", `${num(c)}${String(v).padStart(2, "0")}`),
};

const reverse = (tt: string, toSlug: (digits: string) => string) => (uuid: string) => {
  const m = new RegExp(`^${PREFIX}${tt}-(\\d{12})$`).exec(uuid);
  return m ? toSlug(String(Number(m[1]))) : null;
};

export const slugOf = {
  user: reverse("00", (d) => `u${d}`),
  customer: reverse("01", (d) => `c${d}`),
  pkg: reverse("02", (d) => `pkg_${d}`),
  order: reverse("03", (d) => `PO-${d}`),
  task: reverse("06", (d) => `T-${d}`),
};
