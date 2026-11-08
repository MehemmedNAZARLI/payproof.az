import { createSerwistRoute } from "@serwist/turbopack";

// Bundles src/app/sw.ts at build time and serves it at /serwist/sw.js.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });
