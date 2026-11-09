import { unwrap } from "@payproof/api-client";
import { describe, expect, it } from "vitest";
import { id } from "../src/ids";
import { as } from "./api";
import { assertSchema } from "./contract";

const unec = id.customer("c3");

describe("configuration handlers (ADR-0011)", () => {
  it("lists the registry without extraction instructions, and the check library", async () => {
    const api = await as("u5");
    const types = await unwrap(api.GET("/v1/document-types"));
    expect(types.items.map((t) => t.key)).toContain("bank_statement");
    expect(types.items[0]).not.toHaveProperty("instructions");
    for (const t of types.items) assertSchema("DocumentTypeInfo", t);
    const library = await unwrap(api.GET("/v1/check-library"));
    assertSchema("CheckLibrary", library);
    expect(library.families.find((f) => f.type === "document_count")?.system).toBe(true);
  });

  it("serves UNEC's configured set and keeps legacy sets as their profile", async () => {
    const { items } = await unwrap((await as("u5")).GET("/v1/customers"));
    expect(items).toHaveLength(3);
    const c3 = items.find((c) => c.id === unec)!.current_requirements!;
    assertSchema("RequirementSet", c3);
    expect(c3.documents?.map((d) => `${d.name} ${d.min_count}..${d.max_count}`)).toEqual([
      "Faktura 1..10",
      "Bank çıxarışı 1..1",
      "Kart çıxarışı 1..1",
    ]);
    expect(c3.checks?.map((c) => c.id).at(-1)).toBe("U-08");
    expect(c3.output?.submission.address).toBe("qrant-hesabat@unec.test");
    expect(items.find((c) => c.id === id.customer("c2"))!.current_requirements!.checks?.[0]?.type)
      .toBe("legacy_rule"); // prettier-ignore
  });

  it("uploads a .docx template (approver only); other files → 415", async () => {
    const upload = async (user: "u1" | "u2", name: string, bytes: number[]) => {
      const body = new FormData();
      body.append("file", new File([new Uint8Array(bytes)], name));
      return (await as(user)).POST("/v1/customers/{customer_id}/output-templates", {
        params: { path: { customer_id: unec } },
        body: body as never,
        bodySerializer: (b) => b as unknown as FormData,
      });
    };
    await expect(upload("u1", "akt.docx", [0x50, 0x4b, 3, 4])).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(upload("u2", "akt.pdf", [0x25, 0x50])).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
    });
    const t = await unwrap(upload("u2", "akt.docx", [0x50, 0x4b, 3, 4]));
    assertSchema("OutputTemplate", t);
    expect(t.placeholders).toContain("{{grantee_name}}");
  });
});
