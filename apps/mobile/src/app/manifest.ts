import type { MetadataRoute } from "next";

import { appDescription, appName, brand } from "@/lib/brand";

// Chromium's per-scheme override (`user_preferences`, behind a flag today); ignored elsewhere.
type Manifest = MetadataRoute.Manifest & {
  user_preferences?: { color_scheme_dark?: { theme_color: string; background_color: string } };
};

// Served at /manifest.webmanifest; Next adds the <link rel="manifest"> tag.
// Colours: Android draws the splash and status bar from here until the page's meta theme-color
// loads, so they are the page background (as in layout.tsx), not the brand teal — otherwise the
// bar flashes teal and then switches.
export default function manifest(): Manifest {
  return {
    id: "/",
    name: appName,
    short_name: appName,
    description: appDescription,
    lang: "az",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: brand.backgroundLight,
    background_color: brand.backgroundLight,
    user_preferences: {
      color_scheme_dark: {
        theme_color: brand.backgroundDark,
        background_color: brand.backgroundDark,
      },
    },
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
