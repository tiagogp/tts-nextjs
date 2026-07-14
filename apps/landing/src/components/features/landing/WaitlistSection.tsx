import { accentPanelStyle } from "@landing/constants/landing";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage } from "@landing/types/landing";
import { Reveal } from "./LandingPrimitives";
import { WaitlistForm } from "./WaitlistForm";

export function WaitlistSection({ language }: { language: LandingLanguage }) {
  const t = (portuguese: string) => translateLanding(language, portuguese);

  return (
    <section id="waitlist" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
      <Reveal className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-2xl bg-accent px-6 py-12 text-white sm:px-10 lg:px-14 lg:py-14" style={accentPanelStyle}>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {t("Lista de espera")}
              </p>
              <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] sm:text-5xl">
                {t("Quer testar com os seus vídeos e os seus erros?")}
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-white/85">
                {t("A próxima rodada procura pessoas com Mac Apple Silicon que já tentam transformar inglês real em prática. Responda às três perguntas para receber um convite quando sua vaga estiver pronta.")}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
              <WaitlistForm language={language} />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
