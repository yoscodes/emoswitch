import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthSync } from "@/components/auth-sync";
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
  title: "Concept Forge",
  description: "言葉にできない事業案を、伝わるコンセプトへ鍛える起業家向けワークスペース。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthSync />
        {children}
      </body>
    </html>
  );
}
