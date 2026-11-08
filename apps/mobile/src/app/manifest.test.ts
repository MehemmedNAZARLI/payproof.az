import { describe, expect, it } from "vitest";

import { brand } from "@/lib/brand";

import manifest from "./manifest";

describe("web app manifest", () => {
  const m = manifest();

  it("has the fields Chrome needs to install the app", () => {
    expect(m).toMatchObject({ name: "PayProof", start_url: "/", display: "standalone" });
    const sizes = m.icons?.filter((i) => i.purpose === "any").map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("ships a maskable icon for Android adaptive icons", () => {
    expect(m.icons?.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("uses Azerbaijani and the brand colours", () => {
    expect(m).toMatchObject({ lang: "az", theme_color: brand.primary });
    expect(m.background_color).toBe(brand.backgroundLight);
  });
});
