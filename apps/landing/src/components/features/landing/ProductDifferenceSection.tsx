import { motion } from "motion/react";
import {
  cardHover,
  features,
  listItem,
  staggerContainer,
  warmPatternStyle,
} from "@landing/constants/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage } from "@landing/types/landing";
import { Reveal, SectionLabel } from "./LandingPrimitives";

const PRODUCT_PATHS = [
  ["Entrada", "YouTube, artigos, PDFs, escrita e frases avulsas"],
  ["Prática", "Cards com áudio, revisão e treino dos seus erros"],
] as const;

export function ProductDifferenceSection({ language }: { language: LandingLanguage }) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <SectionLabel>{t("O ciclo completo de aprendizagem")}</SectionLabel>
            <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] text-ink sm:text-5xl">
              {t("Mais do que transformar texto em voz.")}
            </h2>
          </div>
          <p className="text-lg leading-8 text-ink-soft">
            {t("O PhraseLoop conecta conteúdo real, frases escolhidas, cards com áudio, revisão espaçada e treinos criados a partir do que você erra.")}
          </p>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div className="rounded-lg border border-line bg-card p-6 sm:p-8" style={warmPatternStyle} whileHover={cardHover}>
            <p className="text-sm font-semibold text-accent">{t("A diferença do produto")}</p>
            <h3 className="brand-wordmark mt-4 text-3xl font-normal leading-[0.98] text-ink sm:text-4xl">
              {t("Você não estuda frases aleatórias. Estuda o que já encontrou, ouviu, guardou e precisa usar de novo.")}
            </h3>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted">
              {t("O app mantém fonte, áudio, card e histórico conectados, em vez de espalhar sua prática por várias ferramentas.")}
            </p>
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {PRODUCT_PATHS.map(([label, body]) => (
              <motion.div key={label} className="rounded-lg border border-line bg-card p-5" whileHover={cardHover}>
                <p className="text-xs font-semibold uppercase text-accent">{t(label)}</p>
                <p className="mt-3 text-xl font-semibold leading-7 text-ink">{t(body)}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="mt-12 max-w-2xl">
          <SectionLabel>{t("O que continua ligado à frase")}</SectionLabel>
          <h3 className="brand-wordmark text-3xl font-normal leading-[0.98] text-ink sm:text-4xl">
            {t("As partes importantes ficam juntas.")}
          </h3>
        </div>
        <motion.div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {features.map((feature) => (
            <motion.article key={feature.title} className="rounded-lg border border-line bg-card p-5" variants={listItem} whileHover={cardHover}>
              <motion.div className="mb-5 h-1.5 w-10 rounded bg-accent" initial={{ width: 18 }} whileInView={{ width: 40 }} viewport={{ once: true }} />
              <h3 className="text-xl font-semibold leading-7 text-ink">{t(feature.title)}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{t(feature.body)}</p>
            </motion.article>
          ))}
        </motion.div>
      </Reveal>
    </section>
  );
}
