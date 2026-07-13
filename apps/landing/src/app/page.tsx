import type { Metadata } from "next";
import LandingPage from "@landing/components/features/landing/LandingPage";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@landing/constants/seo";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PhraseLoop",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationApplication",
  operatingSystem: "macOS (Apple Silicon)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
