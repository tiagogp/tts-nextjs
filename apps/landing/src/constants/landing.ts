import type { CSSProperties } from "react";
import type { Variants } from "motion/react";
import { HOME_TABS } from "@/components/app/homeTabs";
import { springSnappy } from "@/lib/motion";
import type { LandingSectionId } from "@landing/types/landing";

export type { LandingSectionId } from "@landing/types/landing";

export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

export const ctaReveal: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(14px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.35, ease: [0.22, 1, 0.36, 1] },
  },
};

export const cardHover = {
  y: -4,
  transition: springSnappy,
};

export const appStageStyle = {
  backgroundImage:
    "linear-gradient(rgba(255, 86, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 86, 0, 0.08) 1px, transparent 1px), linear-gradient(135deg, rgba(255, 86, 0, 0.10), rgba(250, 249, 246, 0) 42%)",
  backgroundSize: "30px 30px, 30px 30px, 100% 100%",
} satisfies CSSProperties;

export const warmPatternStyle = {
  backgroundImage:
    "radial-gradient(circle at 18% 0%, rgba(255, 86, 0, 0.13), transparent 34%), linear-gradient(rgba(255, 86, 0, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 86, 0, 0.055) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 28px 28px, 28px 28px",
} satisfies CSSProperties;

export const darkPatternStyle = {
  backgroundImage:
    "radial-gradient(circle at 16% 0%, rgba(255, 86, 0, 0.30), transparent 30%), linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 32px 32px, 32px 32px",
} satisfies CSSProperties;

export const accentPanelStyle = {
  backgroundImage:
    "radial-gradient(circle at 84% 0%, rgba(255, 255, 255, 0.24), transparent 38%), linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 32px 32px, 32px 32px",
} satisfies CSSProperties;

export const flowSteps = [
  {
    label: "YouTube / PDF / artigo / escrita",
    title: "Traga inglês real",
    body: "Cole um vídeo, carregue um documento, salve um artigo ou escreva suas próprias frases.",
  },
  {
    label: "Transcrição / correção",
    title: "Guarde o que importa",
    body: "Revise trechos, ajuste frases e guarde as linhas que valem aprender.",
  },
  {
    label: "Cards para lembrar ativamente",
    title: "Transforme em revisão",
    body: "Crie cards com contexto, áudio e perguntas ligadas ao que ainda precisa de prática.",
  },
  {
    label: "Revisão / treino",
    title: "Feche o ciclo",
    body: "Revise no PhraseLoop e transforme seus pontos fracos no próximo treino curto.",
  },
] as const;

export const features = [
  {
    title: "Áudio original do conteúdo",
    body: "Quando a fonte tem áudio, cada card mantém o trecho exato em que a frase foi dita.",
  },
  {
    title: "Dados locais por padrão",
    body: "Transcrição, áudio gerado, revisões e cards ficam no seu computador. Serviços externos só entram quando você escolhe.",
  },
  {
    title: "Seus erros viram treino",
    body: "As correções não somem em uma anotação. Elas viram frases para você revisar amanhã.",
  },
  {
    title: "Reforço do que ainda falha",
    body: "O PhraseLoop acompanha padrões esquecidos e os transforma em prática focada.",
  },
] as const;

export const differences = [
  {
    title: "Inglês real, não frases soltas",
    body: "Comece com entrevistas, artigos, PDFs e sua própria escrita. O contexto continua ligado ao card.",
  },
  {
    title: "O áudio faz parte da memória",
    body: "Trechos de vídeos mantêm o áudio original; frases de texto podem ganhar áudio gerado no próprio Mac.",
  },
  {
    title: "A revisão volta aos seus erros",
    body: "Revisões e correções trabalham juntas para que erros repetidos virem o próximo alvo de prática.",
  },
] as const;

export const insidePanels = [
  {
    title: "Descobrir",
    eyebrow: "Da fonte para as frases",
    body: "Um vídeo, artigo, PDF ou texto vira trechos que você pode ouvir e guardar.",
  },
  {
    title: "Praticar / Estudar",
    eyebrow: "Da lembrança ao progresso",
    body: "Cards do dia e padrões difíceis ficam visíveis para cada sessão ter um alvo claro.",
  },
  {
    title: "Corrigir / Falar",
    eyebrow: "Da escrita para o treino",
    body: "Corrija sua escrita e reutilize as mesmas frases como material de estudo.",
  },
] as const;

export const privacyCards = [
  {
    title: "Caminho padrão",
    body: "Transcrição, áudio, cards e histórico de revisão ficam no seu computador.",
    image: "/image-1.png",
  },
  {
    title: "Nuvem opcional",
    body: "Claude ou OpenAI só são usados quando você escolhe um deles.",
    image: "/image-2.png",
  },
  {
    title: "Modelos locais",
    body: "O suporte ao Ollama mantém a criação assistida de cards no seu Mac.",
    image: "/image-3.png",
  },
] as const;

export const landingNavItems: ReadonlyArray<{
  id: LandingSectionId;
  label: string;
}> = [
  { id: "workflow", label: "Como funciona" },
  { id: "inside", label: "Por dentro" },
  { id: "privacy", label: "Privacidade" },
  { id: "waitlist", label: "Lista de espera" },
];

// The landing preview has no "Hoje" home surface; it opens straight on Discover.
export const LANDING_TABS = HOME_TABS.filter((item) => item.id !== "hoje");
