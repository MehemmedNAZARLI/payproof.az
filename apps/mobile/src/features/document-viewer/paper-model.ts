// A document drawn as paper (prototype docPage): what the mock shows instead of a PDF. Every
// region that evidence can cite carries the quote the rule engine writes for it, so the viewer
// highlights a region by comparing quotes.

export type PaperCell = { text: string; align?: "right" };
export type PaperRegion = {
  label: string;
  value: string;
  /** The evidence quote for this region; null when it cannot be cited (unreadable). */
  quote: string | null;
  /** Text the scan did not read reliably: shown blurred, never highlighted. */
  unreadable?: boolean;
};

export type PaperPage = {
  kind: "invoice" | "order" | "delivery";
  issuer: { name: string; detail: string };
  title: string;
  number: string;
  meta: PaperRegion[];
  /** e.g. "Namizəd — təsdiqlənməyib" for an order nobody confirmed yet. */
  notice?: string;
  columns: PaperCell[];
  rows: { cells: PaperCell[]; quote: string | null }[];
  total?: { label: string; value: string; quote: string | null };
  signatures?: { delivered: string; received: string; signed: boolean; quote: string | null };
  stamp?: string;
  footer: { page: string; file: string };
  scan: boolean;
};

export type PaperDocument = { pages: PaperPage[] };

/** Every quote a page can highlight. */
export const pageQuotes = (page: PaperPage): (string | null | undefined)[] => [
  ...page.meta.map((r) => r.quote),
  ...page.rows.map((r) => r.quote),
  page.total?.quote,
  page.signatures?.quote,
];
