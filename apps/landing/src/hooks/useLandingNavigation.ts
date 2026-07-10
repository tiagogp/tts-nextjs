"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { landingNavItems } from "@landing/constants/landing";
import type { LandingSectionId } from "@landing/types/landing";

export function useLandingNavigation() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<LandingSectionId | null>(
    null,
  );
  // Header animations stay off until it has snapped to the real scroll
  // position once. Otherwise a reload while scrolled springs the full-width
  // header down into the compact pill ("gets huge then shrinks").
  const [headerReady, setHeaderReady] = useState(false);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";

    const updateHeaderState = () => {
      setScrolled(window.scrollY > 28);

      let current: LandingSectionId | null = null;
      for (const { id } of landingNavItems) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= 150) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    updateHeaderState();
    const raf = requestAnimationFrame(() => setHeaderReady(true));
    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateHeaderState);
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  const handleSectionLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, sectionId: LandingSectionId) => {
      setActiveSection(sectionId);

      const target = document.getElementById(sectionId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${sectionId}`);
    },
    [],
  );

  return { scrolled, activeSection, headerReady, handleSectionLinkClick };
}
