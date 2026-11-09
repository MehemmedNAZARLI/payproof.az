import { describe, expect, it } from "vitest";

import { brand } from "@/lib/brand";

import { viewport } from "./layout";
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

  it("launches in the page's own colours, so the status bar does not flash at start", () => {
    // Android paints the splash and status bar from the manifest until the page's meta
    // theme-color loads; both must already be the page background (layout.tsx viewport).
    expect(m).toMatchObject({ lang: "en", theme_color: viewport.themeColor });
    expect(m.background_color).toBe(brand.backgroundLight);
  });

});
