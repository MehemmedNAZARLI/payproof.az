import preset from "@payproof/design-tokens/tailwind-preset";
import type { Config } from "tailwindcss";

// Tailwind v4 loads this through `@config` in globals.css; sources are detected automatically.
const config = { presets: [preset], content: ["./src/**/*.{ts,tsx}"] } satisfies Config;

export default config;
