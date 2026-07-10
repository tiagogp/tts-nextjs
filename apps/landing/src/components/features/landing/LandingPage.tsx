"use client";

import { LandingFooter } from "@landing/components/layout/LandingFooter";
import { LandingHeader } from "@landing/components/layout/LandingHeader";
import { useLandingLanguage } from "@landing/hooks/useLandingLanguage";
import { useLandingNavigation } from "@landing/hooks/useLandingNavigation";
import { HeroSection } from "./HeroSection";
import { InsideSection } from "./InsideSection";
import { PrivacySection } from "./PrivacySection";
import { ProductDifferenceSection } from "./ProductDifferenceSection";
import { WaitlistSection } from "./WaitlistSection";
import { WorkflowSection } from "./WorkflowSection";

export default function LandingPage() {
  const { language, changeLanguage } = useLandingLanguage();
  const { scrolled, activeSection, headerReady, handleSectionLinkClick } =
    useLandingNavigation();

  return (
    <main className="min-h-screen bg-surface text-ink">
      <LandingHeader
        activeSection={activeSection}
        headerReady={headerReady}
        language={language}
        scrolled={scrolled}
        onLanguageChange={changeLanguage}
        onSectionLinkClick={handleSectionLinkClick}
      />
      <HeroSection language={language} onSectionLinkClick={handleSectionLinkClick} />
      <WorkflowSection language={language} />
      <ProductDifferenceSection language={language} />
      <InsideSection language={language} />
      <PrivacySection language={language} />
      <WaitlistSection language={language} />
      <LandingFooter language={language} onSectionLinkClick={handleSectionLinkClick} />
    </main>
  );
}
