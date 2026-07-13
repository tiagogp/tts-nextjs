import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Archivo_Black } from "next/font/google";
import ThemeInitScript from "@/components/app/ThemeInitScript";
import ThemeProvider from "@/components/app/ThemeProvider";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@landing/constants/seo";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — PhraseLoop",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "learn English",
    "English from YouTube videos",
    "English flashcards",
    "A2 B1 English practice",
    "English app for Mac",
    "spaced repetition",
    "PhraseLoop",
  ],
  applicationName: "PhraseLoop",
  authors: [{ name: "PhraseLoop" }],
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["pt_BR"],
    url: SITE_URL,
    siteName: "PhraseLoop",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1918" },
  ],
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
        <ThemeInitScript />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
