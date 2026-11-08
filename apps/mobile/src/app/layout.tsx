import type { Metadata, Viewport } from "next";

import { appDescription, appName, brand } from "@/lib/brand";

import { Providers } from "./providers";

import "./globals.css";

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
    <html lang="az">
      <body className="bg-bg text-text font-sans text-md">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
