import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SES業務管理システム",
  description: "技術者・案件・アサイン・契約・工数・請求・営業を一括管理",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
