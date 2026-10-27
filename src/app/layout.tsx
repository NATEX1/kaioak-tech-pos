import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";

import { themeInitScript } from "@/lib/theme";

import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: "variable",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KAIOAK TECH — ระบบขายหน้าร้านและงานซ่อม",
    template: "%s | KAIOAK TECH",
  },
  description:
    "ระบบ POS สำหรับร้านคอมพิวเตอร์: ขายสินค้า งานซ่อม บริการ เคลมสินค้า สต๊อก และค่าคอมมิชชั่น",
  applicationName: "KAIOAK TECH POS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${notoSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
