import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Archivo_Black } from "next/font/google";
import ThemeInitScript from "@/components/app/ThemeInitScript";
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
  title: "PhraseLoop — inglês real vira prática",
  description:
    "Transforme vídeos em cards com o áudio original e os seus próprios erros no treino de amanhã.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivoBlack.variable} h-full antialiased`}
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
