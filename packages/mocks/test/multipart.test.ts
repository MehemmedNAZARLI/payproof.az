import { describe, expect, it } from "vitest";
import { fileField } from "../src/handlers/multipart";

const formWith = (file: File) => {
  const f = new FormData();
  f.append("file", file);
  return f;
};

describe("multipart file limits", () => {
  it("accepts the contract's file types", () => {
    for (const name of ["a.pdf", "b.PNG", "c.jpeg", "d.csv", "e.xlsx"])
      expect(fileField(formWith(new File(["x"], name)), "file")?.name).toBe(name);
  });
  it("rejects other types (415), oversized files (413) and a missing file (422)", () => {
    expect(() => fileField(formWith(new File(["x"], "m.docm")), "file")).toThrow(
      expect.objectContaining({ status: 415 }),
    );
    const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.pdf");
    expect(() => fileField(formWith(big), "file")).toThrow(
      expect.objectContaining({ status: 413 }),
    );
    expect(() => fileField(new FormData(), "file")).toThrow(
      expect.objectContaining({ status: 422 }),
    );
    expect(fileField(new FormData(), "order", true)).toBeNull();
  });
});
