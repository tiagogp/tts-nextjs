import { motion } from "motion/react";
import {
  cardHover,
  insidePanels,
  listItem,
  staggerContainer,
} from "@landing/constants/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage } from "@landing/types/landing";
import { Reveal, SectionLabel } from "./LandingPrimitives";
import { MiniScreen } from "./MiniScreen";
import { YourSection } from "./YourSection";

export function InsideSection({ language }: { language: LandingLanguage }) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section
      id="inside"
      className="scroll-mt-24 border-y border-line bg-card px-4 py-16 sm:px-6 lg:px-8"
    >
      <Reveal className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>{t("Por dentro do app")}</SectionLabel>
          <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] text-ink sm:text-5xl">
            {t("Um espaço no Mac para transformar conteúdo em prática.")}
          </h2>
          <p className="mt-4 text-lg leading-8 text-ink-soft">
            {t("As áreas do app são etapas do mesmo ciclo. Assim, cada frase mantém sua origem e encontra o próximo passo de revisão.")}
          </p>
        </div>
        <div className="mt-10">
          <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">{t("Um caminho real de estudo")}</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{t("Acompanhe uma frase enquanto ela passa pelo app.")}</p>
              </div>
              <span className="rounded border border-line bg-card px-3 py-1.5 text-xs font-semibold text-accent">
                {t("uma frase, o ciclo inteiro")}
              </span>
            </div>
            <YourSection language={language} />
          </div>
          <motion.div className="mt-6 grid gap-4 md:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.22 }}>
            {insidePanels.map((panel) => (
              <motion.article key={panel.title} variants={listItem} className="flex h-full flex-col rounded-lg border border-line bg-surface p-4" whileHover={cardHover}>
                <p className="text-xs font-semibold uppercase text-accent">{t(panel.eyebrow)}</p>
                <h3 className="brand-wordmark mt-2 text-3xl font-normal leading-none text-ink">{t(panel.title)}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink-muted">{t(panel.body)}</p>
                <div className="mt-5">
                  <MiniScreen
                    kind={panel.title.startsWith("Descobrir") ? "discover" : panel.title.startsWith("Praticar") ? "practice" : "correct"}
                    language={language}
                    title={t(panel.title).split(" / ")[0]}
                  />
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </Reveal>
    </section>
  );
}
