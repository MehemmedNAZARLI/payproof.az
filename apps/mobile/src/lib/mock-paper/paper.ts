import company from "@fixtures/company.json";
import packages from "@fixtures/packages.json";

import type { PaperDocument, PaperPage } from "@/features/document-viewer/paper-model";
import { formatDate } from "@/lib/format";

import {
  customer,
  type Delivery,
  type Order,
  type PackageModel,
  packageModel,
  product,
} from "./model";
import { deliveryQuote, invoiceQuote, lineSum, money, orderQuote, quantity } from "./quotes";

// Mock mode only: @payproof/mocks links to placeholder files with no bytes, so a document version
// is drawn from its fixture data (prototype docPage). Fixtures keep only the latest data, so older
// versions draw the same. Quotes match the mock's evidence (both port the prototype's ev()).

const PRICED = [
  { text: "Kod" },
  { text: "Məhsul" },
  { text: "Miqdar", align: "right" as const },
  { text: "Qiymət", align: "right" as const },
  { text: "Məbləğ", align: "right" as const },
];
const footer = (file: string, version?: number) => ({
  page: "Səhifə 1 / 1",
  file: version ? `${file} · v${version}` : file,
});

function invoicePage(m: PackageModel, file: string, version: number, scan: boolean): PaperPage {
  const inv = m.invoice;
  return {
    kind: "invoice",
    issuer: { name: company.name, detail: `VÖEN ${company.voen} · ${company.address}` },
    title: "HESAB-FAKTURA",
    number: inv.number,
    meta: [
      {
        label: "Alıcı",
        value: `${m.customer.name}, VÖEN ${m.customer.voen}`,
        quote: invoiceQuote(m, "customer"),
      },
      { label: "Tarix", value: formatDate(inv.date), quote: null },
      inv.poUnreadable
        ? { label: "Sifariş №", value: inv.poRaw ?? "?", quote: null, unreadable: true }
        : { label: "Sifariş №", value: inv.poRef ?? "—", quote: invoiceQuote(m, "po") },
      { label: "Valyuta · ödəniş şərti", value: `${m.currency} · 30 gün`, quote: null },
    ],
    columns: PRICED,
    rows: inv.lines.map((l) => ({
      cells: pricedCells(l),
      quote: invoiceQuote(m, `line:${l.code}`),
    })),
    total: {
      label: "Yekun (ƏDV daxil)",
      value: money(inv.total, m.currency),
      quote: invoiceQuote(m, "total"),
    },
    footer: footer(file, version),
    scan,
  };
}

function pricedCells(l: { code: string; qty: number; price: bigint }) {
  const p = product(l.code);
  return [
    { text: l.code },
    { text: p.description },
    { text: `${quantity(l.qty)} ${p.unit}`, align: "right" as const },
    { text: money(l.price), align: "right" as const },
    { text: money(l.price * BigInt(l.qty)), align: "right" as const },
  ];
}

function orderPage(o: Order, confirmed: boolean, scan: boolean): PaperPage {
  const buyer = customer(o.customerId);
  return {
    kind: "order",
    issuer: { name: buyer.name, detail: `Satınalma şöbəsi · VÖEN ${buyer.voen}` },
    title: "SİFARİŞ",
    number: o.po,
    meta: [
      { label: "Sifariş №", value: o.po, quote: orderQuote(o, "po") },
      { label: "Sifarişçi", value: buyer.name, quote: orderQuote(o, "customer") },
      { label: "Tarix · valyuta", value: `${formatDate(o.date)} · ${o.currency}`, quote: null },
      { label: "Təchizatçı", value: company.name, quote: null },
    ],
    notice: confirmed ? undefined : "Namizəd — təsdiqlənməyib",
    columns: PRICED,
    rows: o.lines.map((l) => ({ cells: pricedCells(l), quote: orderQuote(o, `line:${l.code}`) })),
    total: {
      label: "Cəm",
      value: money(lineSum(o.lines), o.currency),
      quote: orderQuote(o, "total"),
    },
    footer: footer(`${o.po}.pdf`),
    scan,
  };
}

function deliveryPage(d: Delivery, file: string, version: number, scan: boolean): PaperPage {
  const receiver = customer(d.customerId);
  return {
    kind: "delivery",
    issuer: { name: company.name, detail: "Anbar: Bakı, Sabunçu r., Logistika mərkəzi №2" },
    title: "TƏHVİL-TƏSLİM AKTI",
    number: d.no,
    meta: [
      { label: "Qəbul edən", value: receiver.name, quote: deliveryQuote(d, "customer") },
      { label: "Tarix", value: formatDate(d.date), quote: null },
      { label: "Əsas: sifariş", value: d.poRef, quote: deliveryQuote(d, "po") },
      { label: "Nəqliyyat", value: "10-AB-482", quote: null },
    ],
    columns: [
      { text: "Kod" },
      { text: "Məhsul" },
      { text: "Təhvil verilən miqdar", align: "right" },
    ],
    rows: d.lines.map((l) => {
      const p = product(l.code);
      return {
        cells: [
          { text: l.code },
          { text: p.description },
          { text: `${quantity(l.qty)} ${p.unit}`, align: "right" as const },
        ],
        quote: deliveryQuote(d, `line:${l.code}`),
      };
    }),
    signatures: {
      delivered: "Təhvil verdi: E. Qasımov",
      received: "Qəbul etdi (imza, möhür)",
      signed: d.signed,
      quote: deliveryQuote(d, "signature"),
    },
    stamp: d.signed ? receiver.name.split(" ")[0]!.toLocaleUpperCase("az") : undefined,
    footer: footer(file, version),
    scan,
  };
}

const DOC_TYPES = ["invoice", "order", "delivery"] as const;
// @payproof/mocks version IDs: 0193a000-0000-7000-8005-0000<package><type 1-3><version 001>
const VERSION_ID = /^0193a000-0000-7000-8005-0000(\d{4})([123])(\d{3})$/;

/** The fixture package, document type and file behind a mock document version ID. */
function findVersion(versionId: string) {
  const m = VERSION_ID.exec(versionId);
  if (!m) return undefined;
  const pkg = packages.find((p) => p.id === `pkg_${Number(m[1])}`);
  const type = DOC_TYPES[Number(m[2]) - 1]!;
  const version = pkg?.documents
    .find((d) => d.type === type)
    ?.versions.find((v) => v.version_no === Number(m[3]));
  return pkg && version ? { pkg, type, version } : undefined;
}

/** The paper for a mock file link's document version. */
export function mockPaper(versionId: string): PaperDocument | undefined {
  const found = findVersion(versionId);
  if (!found) return undefined;
  const m = packageModel(found.pkg);
  const { file_name: file, version_no: version, source_kind } = found.version;
  const scan = source_kind === "scan";
  if (found.type === "invoice") return { pages: [invoicePage(m, file, version, scan)] };
  if (found.type === "order")
    return { pages: m.orderPages.map((o) => orderPage(o, m.order !== null, scan)) };
  return m.delivery ? { pages: [deliveryPage(m.delivery, file, version, scan)] } : undefined;
}
