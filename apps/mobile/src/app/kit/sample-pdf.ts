// A tiny, valid PDF built in the page (no binary fixture): one A4 portrait page and one A4
// landscape page of Helvetica text, to preview the PDF viewer in the mock build.

type SamplePage = { width: number; height: number; lines: string[] };

const escape = (text: string) => text.replace(/[\\()]/g, (c) => `\\${c}`);

function content(page: SamplePage) {
  const ops = page.lines.map(
    (line, i) =>
      `BT /F1 ${i === 0 ? 20 : 12} Tf 56 ${page.height - 72 - i * 22} Td (${escape(line)}) Tj ET`,
  );
  return ops.join("\n");
}

export function samplePdf(pages: SamplePage[]): string {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) + 2; // ids 1 and 2 are catalog and pages
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids = pages.map((p) => {
    const stream = content(p);
    const contents = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] ` +
        `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contents} 0 R >>`,
    );
  });
  const all = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`,
    ...objects,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = all.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${all.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

export const SAMPLE_PAGES: SamplePage[] = [
  {
    width: 595,
    height: 842,
    lines: [
      "INVOICE INV-1042",
      "A Distribusiya MMC - VOEN 1700123451",
      "Buyer: B Magazalar Sebekesi - VOEN 1402375611",
      "Order No: (none)",
      "GY-1L  Sunflower oil, 1 L      800 x 9.00   7,200.00",
      "DY-5   Basmati rice, 5 kg      400 x 12.00  4,800.00",
      "Total (VAT incl.): 12,000.00 AZN",
    ],
  },
  { width: 842, height: 595, lines: ["APPENDIX - landscape page", "Delivery schedule, week 45"] },
];
