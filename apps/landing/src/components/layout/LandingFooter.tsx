import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { hoverLift, tapPress } from "@/lib/motion";
import { Reveal } from "@landing/components/features/landing/LandingPrimitives";
import { darkPatternStyle } from "@landing/constants/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage, LandingSectionId } from "@landing/types/landing";

type LandingFooterProps = {
  language: LandingLanguage;
  onSectionLinkClick: (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: LandingSectionId,
  ) => void;
};

export function LandingFooter({ language, onSectionLinkClick }: LandingFooterProps) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section
      id="next-round"
      className="scroll-mt-24 border-t border-[#2b2926] bg-[#111111] px-4 py-16 text-[#faf9f6] sm:px-6 lg:px-8"
      style={darkPatternStyle}
    >
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase text-accent">
          {t("Próxima rodada")}
        </p>
        <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] sm:text-5xl">
          {t("Teste o PhraseLoop antes do lançamento.")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[#d8d3ca]">
          {t("Entre na lista para testar o ciclo completo no seu Mac com seus próprios vídeos, frases e erros.")}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["macOS Apple Silicon", "A2-B1", "Teste acompanhado"].map((item) => (
            <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#d8d3ca]">
              {t(item)}
            </span>
          ))}
        </div>
        <motion.a
          href="#waitlist"
          onClick={(event) => onSectionLinkClick(event, "waitlist")}
          whileHover={hoverLift}
          whileTap={tapPress}
          className="mt-7 inline-flex items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white"
        >
          {t("Entrar na lista de espera")}
        </motion.a>
        <p className="mt-6 text-xs text-[#d8d3ca]">
          {t("Criado por")} {" "}
          <a
            href="https://github.com/tiagogp"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-white underline decoration-accent underline-offset-4 transition-colors hover:text-accent"
          >
            Tiago GP
          </a>
        </p>
      </Reveal>
    </section>
  );
}
