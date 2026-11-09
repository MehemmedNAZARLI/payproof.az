import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PayProof",
  description: "Fakturanı sifariş və təhvil sənədləri ilə tutuşdurun",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="az">
      {/* Tailwind preflight sets its own font stack; the token stack (system fonts) goes on body. */}
      <body className="bg-bg text-text font-sans text-md antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
