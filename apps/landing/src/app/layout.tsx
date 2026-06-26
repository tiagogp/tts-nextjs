import type { Metadata } from "next";
import { Archivo_Black, Geist } from "next/font/google";
import ThemeProvider from "@/components/app/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "PhraseLoop - Local-first English practice",
  description:
    "Turn real English into audio-backed flashcards, practice sessions, and focused drills - locally by default.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${archivoBlack.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
