import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import ThemeInitScript from "@/components/app/ThemeInitScript";
import ThemeProvider from "@/components/app/ThemeProvider";
import "./globals.css";

const fontVariables = {
  "--font-geist-sans": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "--font-brand": "\"Arial Black\", Impact, ui-sans-serif, system-ui, sans-serif",
} as CSSProperties;

export const metadata: Metadata = {
  title: "PhraseLoop",
  description: "Convert text into natural English speech and download the audio file.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeInitScript />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
