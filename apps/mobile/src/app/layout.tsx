import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PayProof",
  description: "Faktura paketlərinin hazırlığı və təsdiqi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
