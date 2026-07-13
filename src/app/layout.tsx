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
  description: "Aprenda inglês com frases reais: salve, revise e transforme seus erros em prática.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    // Static default matches the default learner profile (pt native, A1);
    // I18nProvider re-stamps `lang` at runtime when the profile resolves to English UI.
    <html
      lang="pt-BR"
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
