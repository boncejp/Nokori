import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nokori",
    template: "%s | Nokori",
  },
  description:
    "貯金目標に沿って「今日いくら使っていいか」を一目で把握する、貯金伴走型の家計アプリ。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Nokori",
    title: "Nokori",
    description:
      "貯金目標に沿って「今日いくら使っていいか」を一目で把握する、貯金伴走型の家計アプリ。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
