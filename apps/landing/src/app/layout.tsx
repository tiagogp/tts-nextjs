import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Archivo_Black } from "next/font/google";
import ThemeProvider from "@/components/app/ThemeProvider";
import "./globals.css";

const archivoBlack = Archivo_Black({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: "400",
  fallback: ["Arial Black", "Impact", "sans-serif"],
});

const fontVariables = {
  "--font-geist-sans": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
} as CSSProperties;

export const metadata: Metadata = {
  title: "PhraseLoop - Local-first English practice",
  description:
    "Turn real English into audio-backed flashcards, practice sessions, and focused drills - locally by default.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} h-full antialiased`}
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
