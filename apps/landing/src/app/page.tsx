import type { Metadata } from "next";
import LandingPage from "@landing/components/features/landing/LandingPage";

export const metadata: Metadata = {
  title: "PhraseLoop — inglês real vira prática",
  description:
    "Transforme vídeos em cards com o áudio original e os seus próprios erros no treino de amanhã.",
};

export default function Home() {
  return <LandingPage />;
}
