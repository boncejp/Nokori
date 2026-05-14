import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
