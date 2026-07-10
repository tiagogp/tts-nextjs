import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { hoverLift, tapPress } from "@/lib/motion";
import {
  appStageStyle,
  cardHover,
  ctaReveal,
  differences,
  listItem,
  staggerContainer,
} from "@landing/constants/landing";
import type { LandingLanguage, LandingSectionId } from "@landing/types/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import { AppMockup } from "./AppMockup";

type HeroSectionProps = {
  language: LandingLanguage;
  onSectionLinkClick: (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: LandingSectionId,
  ) => void;
};

export function HeroSection({ language, onSectionLinkClick }: HeroSectionProps) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section className="px-4 pb-12 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div id="top" className="scroll-mt-28 space-y-8">
          <motion.div
            className="relative mx-auto max-w-4xl text-center"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.p
              className="mb-4 text-sm font-semibold text-accent"
              variants={listItem}
            >
              {t("Inglês real. Áudio original. Pronto para revisar.")}
            </motion.p>
            <motion.h1
              className="brand-wordmark text-6xl font-normal leading-[0.9] text-ink sm:text-7xl lg:text-8xl"
              variants={listItem}
            >
              PhraseLoop<span className="text-fin">.</span>
            </motion.h1>
            <motion.p
              className="mx-auto mt-5 max-w-3xl text-xl leading-8 text-ink-soft sm:text-2xl sm:leading-9"
              variants={listItem}
            >
              {t(
                "Cole um vídeo do YouTube. Em 2 minutos, as melhores frases viram cards de revisão com o áudio original — e os seus próprios erros viram o treino de amanhã.",
              )}
            </motion.p>
            <motion.div
              className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"
              variants={ctaReveal}
            >
              <motion.a
                href="#waitlist"
                onClick={(event) => onSectionLinkClick(event, "waitlist")}
                whileHover={hoverLift}
                whileTap={tapPress}
                className="inline-flex items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white"
              >
                {t("Entrar na lista de espera")}
              </motion.a>
              <motion.a
                href="#workflow"
                onClick={(event) => onSectionLinkClick(event, "workflow")}
                whileHover={hoverLift}
                whileTap={tapPress}
                className="inline-flex items-center justify-center rounded border border-line bg-card px-5 py-3 text-sm font-semibold text-ink"
              >
                {t("Ver como funciona")}
              </motion.a>
            </motion.div>
            <motion.p className="mt-4 text-sm text-ink-muted" variants={listItem}>
              {t(
                "Para estudantes A2-B1 que estudam por conta própria e usam Mac com Apple Silicon.",
              )}
            </motion.p>
          </motion.div>

          <motion.div
            className="rounded-lg border border-line bg-[#f3eee7] p-2 dark:bg-[#1f1d1b] sm:p-4"
            style={appStageStyle}
            variants={listItem}
            initial="hidden"
            animate="show"
          >
            <AppMockup language={language} />
          </motion.div>

          <motion.div
            className="grid gap-3 md:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {differences.map((item) => (
              <motion.article
                key={item.title}
                className="rounded-lg border border-line bg-card p-4"
                variants={listItem}
                whileHover={cardHover}
              >
                <p className="text-sm font-semibold text-ink">{t(item.title)}</p>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{t(item.body)}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
