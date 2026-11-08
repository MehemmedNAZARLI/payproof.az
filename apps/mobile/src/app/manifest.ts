import type { MetadataRoute } from "next";

import { appDescription, appName, brand } from "@/lib/brand";

// Served at /manifest.webmanifest; Next adds the <link rel="manifest"> tag.
export default function manifest(): MetadataRoute.Manifest {
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
    theme_color: brand.primary,
    background_color: brand.backgroundLight,
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
