import { describe, expect, it } from "vitest";

import { SAMPLE_PAGES, samplePdf } from "./sample-pdf";

describe("samplePdf", () => {
  const pdf = samplePdf(SAMPLE_PAGES);

  it("writes a cross-reference table whose offsets point at each object", () => {
    const xref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((at, i) => expect(pdf.slice(at).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });

  it("has one page per sample, with its own media box", () => {
    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("/MediaBox [0 0 595 842]");
    expect(pdf).toContain("/MediaBox [0 0 842 595]");
  });
});
