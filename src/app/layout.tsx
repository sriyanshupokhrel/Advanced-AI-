import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: { default: "CV Builder", template: "%s · CV Builder" },
  description: "Create, edit and preview CV profiles.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="text-lg font-bold text-indigo-700">
              CV Builder
            </Link>
            <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm font-medium">
              <Link href="/" className="text-slate-600 hover:text-slate-900">
                My CVs
              </Link>
              <Link href="/jobs" className="text-slate-600 hover:text-slate-900">
                Job descriptions
              </Link>
              <Link href="/prepare" className="text-slate-600 hover:text-slate-900">
                Prepare interview
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
