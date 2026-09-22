import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BoxStudio — ออกแบบบรรจุภัณฑ์ออนไลน์",
  description: "ออกแบบกล่องบรรจุภัณฑ์ตามขนาดจริง พร้อมไฟล์ไดคัทสำหรับโรงพิมพ์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Sarabun:ital,wght@0,400;0,700;1,400;1,700&family=Prompt:ital,wght@0,400;0,700;1,400;1,700&family=Kanit:ital,wght@0,400;0,700;1,400;1,700&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
