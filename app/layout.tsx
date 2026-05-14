import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { NOKORI_APP_ICON_PATH } from "@/lib/brand";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Nokori",
  title: {
    default: "Nokori",
    template: "%s | Nokori",
  },
  description:
    "貯金目標に沿って「今日いくら使っていいか」を一目で把握する、貯金伴走型の家計アプリ。",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: NOKORI_APP_ICON_PATH,
        type: "image/png",
        sizes: "192x192",
      },
      {
        url: NOKORI_APP_ICON_PATH,
        type: "image/png",
        sizes: "512x512",
      },
    ],
    apple: [
      {
        url: NOKORI_APP_ICON_PATH,
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
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
