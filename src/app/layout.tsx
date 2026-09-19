import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazirmatn",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "پنل پاسخ‌دهی فروشگاه",
  description:
    "پنل کمک به پاسخ‌دهی پیام مشتری برای فروشندگان فروشگاه‌های کوچک",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
