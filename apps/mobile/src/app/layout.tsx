import "./globals.css";

import type { Metadata, Viewport } from "next";

import { appDescription, appName, brand } from "@/lib/brand";
import { cx } from "@/lib/cx";
import { inter, interExt } from "@/lib/fonts";

import { Providers } from "./providers";

export const metadata: Metadata = {
  applicationName: appName,
  title: { default: appName, template: `%s · ${appName}` },
  description: appDescription,
  appleWebApp: { capable: true, title: appName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brand.backgroundLight },
    { media: "(prefers-color-scheme: dark)", color: brand.backgroundDark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="az" className={cx(inter.variable, interExt.variable)}>
      <body className="bg-bg text-text font-sans text-subhead">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
