import { motion } from "motion/react";
import {
  darkPatternStyle,
  flowSteps,
  listItem,
  staggerContainer,
} from "@landing/constants/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage } from "@landing/types/landing";
import { Reveal } from "./LandingPrimitives";

export function WorkflowSection({ language }: { language: LandingLanguage }) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section
      id="workflow"
      className="scroll-mt-24 border-y border-[#2b2926] bg-[#111111] px-4 py-16 text-[#faf9f6] sm:px-6 lg:px-8"
      style={darkPatternStyle}
    >
      <Reveal className="mx-auto max-w-7xl">
        <p className="mb-3 text-xs font-semibold uppercase text-accent">
          {t("Do conteúdo real para uma lembrança duradoura")}
        </p>
        <div className="mb-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] sm:text-5xl">
            {t("Um ciclo do conteúdo que você gosta ao inglês que você usa.")}
          </h2>
          <p className="text-lg leading-8 text-[#d8d3ca]">
            {t(
              "Encontre uma frase, guarde o trecho útil, revise com o mesmo áudio e volte ao que ainda falha quando você tenta usar o inglês.",
            )}
          </p>
        </div>
        <motion.div
          className="grid gap-3 md:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          {flowSteps.map((step, index) => (
            <motion.article
              key={step.title}
              className="rounded-lg border border-white/15 bg-white/6 p-5"
              variants={listItem}
              whileHover={{ y: -4, borderColor: "rgb(255 86 0 / 0.8)" }}
            >
              <p className="brand-wordmark text-4xl leading-none text-accent">0{index + 1}</p>
              <p className="mt-5 text-xs font-semibold uppercase text-[#d8d3ca]">{t(step.label)}</p>
              <h3 className="mt-3 text-xl font-semibold text-white">{t(step.title)}</h3>
              <p className="mt-2 text-sm leading-6 text-[#d8d3ca]">{t(step.body)}</p>
            </motion.article>
          ))}
        </motion.div>
      </Reveal>
    </section>
  );
}
