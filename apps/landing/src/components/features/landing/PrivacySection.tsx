import type { CSSProperties } from "react";
import { motion } from "motion/react";
import {
  cardHover,
  listItem,
  privacyCards,
  staggerContainer,
} from "@landing/constants/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage } from "@landing/types/landing";
import { Reveal, SectionLabel } from "./LandingPrimitives";

const PRIVACY_TAGS = [
  "Kokoro TTS",
  "Whisper",
  "Dados locais",
  "Ollama",
  "Nuvem opcional",
] as const;

export function PrivacySection({ language }: { language: LandingLanguage }) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section id="privacy" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <SectionLabel>{t("Privacidade e controle")}</SectionLabel>
          <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] text-ink sm:text-5xl">
            {t("Nada sai do seu computador sem você escolher.")}
          </h2>
          <p className="mt-4 text-lg leading-8 text-ink-soft">
            {t("O PhraseLoop guarda cards e revisões localmente e pode transcrever e gerar áudio no próprio Mac. Serviços na nuvem ficam disponíveis apenas quando você decide usá-los.")}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {PRIVACY_TAGS.map((item) => (
              <span key={item} className="rounded border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft">
                {t(item)}
              </span>
            ))}
          </div>
        </div>
        <motion.div className="grid gap-3" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}>
          {privacyCards.map(({ title, body, image }) => (
            <motion.div
              key={title}
              className="min-h-32 rounded-lg border border-line bg-card bg-cover bg-center p-5"
              style={{
                backgroundImage: `linear-gradient(45deg, var(--surface-card) 0%, color-mix(in srgb, var(--surface-card) 96%, transparent) 44%, color-mix(in srgb, var(--surface-card) 64%, transparent) 72%, color-mix(in srgb, var(--surface-card) 20%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, var(--surface-card) 42%, transparent), color-mix(in srgb, var(--surface-card) 18%, transparent)), url(${image})`,
              } as CSSProperties}
              variants={listItem}
              whileHover={cardHover}
            >
              <div className="max-w-[22rem]">
                <p className="text-sm font-semibold text-ink">{t(title)}</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{t(body)}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Reveal>
    </section>
  );
}
