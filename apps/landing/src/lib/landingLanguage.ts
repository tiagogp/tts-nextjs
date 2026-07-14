import type { LandingLanguage } from "@landing/types/landing";

export type { LandingLanguage } from "@landing/types/landing";

export const LANDING_LANGUAGE_KEY = "phraseloop.landing.language";
const LANDING_LANGUAGE_EVENT = "phraseloop:landing-language";

let memoryLanguage: LandingLanguage = "pt";

const ENGLISH_COPY: Record<string, string> = {
  "Como funciona": "How it works",
  "Por dentro": "Inside",
  Privacidade: "Privacy",
  "Lista de espera": "Waitlist",
  "Demonstração interativa com dados de exemplo":
    "Interactive preview with sample data",
  "Trecho de entrevista — criando consistência":
    "Interview clip — building consistency",
  Artigo: "Article",
  "24 hoje": "24 due",
  "9 dias": "9 days",
  "Use em uma frase sobre uma surpresa recente.":
    "Use it in a sentence about a recent surprise.",
  "Gerar áudio no Mac": "Generate audio on your Mac",
  "Qual computador você usa?": "Which computer do you use?",
  "Selecione uma opção": "Select an option",
  "Como você transforma conteúdo em inglês em prática hoje?":
    "How do you turn English content into practice today?",
  "Ex.: salvo frases no Anki, anoto em um caderno, só assisto ao vídeo…":
    "E.g. I save phrases to Anki, write them in a notebook, or just watch the video…",
  "Enviando...": "Sending...",
  "Você está na lista": "You're on the list",
  "Entrar na lista de espera": "Join the waitlist",
  "Não foi possível salvar agora. Tente de novo em alguns segundos.":
    "We couldn't save your entry. Try again in a few seconds.",
  "Obrigado. Nesta rodada, os primeiros convites vão para quem usa Mac com Apple Silicon.":
    "Thanks. This round prioritizes people using Apple Silicon Macs.",
  "Navegação da página": "Page navigation",
  "Inglês real. Áudio original. Pronto para revisar.":
    "Real English. Original audio. Ready to review.",
  "Cole um vídeo do YouTube. Em 2 minutos, as melhores frases viram cards de revisão com o áudio original — e os seus próprios erros viram o treino de amanhã.":
    "Paste a YouTube video. In 2 minutes, the best phrases become review cards with the original audio — and your own mistakes become tomorrow's practice.",
  "Ver como funciona": "See how it works",
  "Para estudantes A2-B1 que estudam por conta própria e usam Mac com Apple Silicon.":
    "For A2-B1 learners studying independently on an Apple Silicon Mac.",
  "Do conteúdo real para uma lembrança duradoura":
    "From real input to lasting recall",
  "Um ciclo do conteúdo que você gosta ao inglês que você usa.":
    "One loop from content you care about to English you can use.",
  "Encontre uma frase, guarde o trecho útil, revise com o mesmo áudio e volte ao que ainda falha quando você tenta usar o inglês.":
    "Find a phrase, keep the useful part, review it with the same audio, and return to what still breaks when you try to use English.",
  "YouTube / PDF / artigo / escrita": "YouTube / PDF / article / writing",
  "Traga inglês real": "Bring in real English",
  "Cole um vídeo, carregue um documento, salve um artigo ou escreva suas próprias frases.":
    "Paste a video, load a document, save an article, or write your own sentences.",
  "Transcrição / correção": "Transcript / correction",
  "Guarde o que importa": "Keep what matters",
  "Revise trechos, ajuste frases e guarde as linhas que valem aprender.":
    "Review segments, correct phrasing, and keep the lines worth learning.",
  "Cards para lembrar ativamente": "Cards for active recall",
  "Transforme em revisão": "Turn it into review",
  "Crie cards com contexto, áudio e perguntas ligadas ao que ainda precisa de prática.":
    "Create cards with context, audio, and prompts tied to what still needs practice.",
  "Revisão / treino": "Review / drill",
  "Feche o ciclo": "Close the loop",
  "Revise no PhraseLoop e transforme seus pontos fracos no próximo treino curto.":
    "Review in PhraseLoop and turn weak spots into your next short drill.",
  "O ciclo completo de aprendizagem": "The complete learning loop",
  "Mais do que transformar texto em voz.": "More than text to speech.",
  "O PhraseLoop conecta conteúdo real, frases escolhidas, cards com áudio, revisão espaçada e treinos criados a partir do que você erra.":
    "PhraseLoop connects real input, selected phrases, audio cards, spaced review, and drills created from your mistakes.",
  "A diferença do produto": "The product difference",
  "Você não estuda frases aleatórias. Estuda o que já encontrou, ouviu, guardou e precisa usar de novo.":
    "You don't study random sentences. You study what you already found, heard, kept, and need to use again.",
  "O app mantém fonte, áudio, card e histórico conectados, em vez de espalhar sua prática por várias ferramentas.":
    "The app keeps the source, audio, card, and history connected instead of scattering your practice across tools.",
  Entrada: "Input",
  "YouTube, artigos, PDFs, escrita e frases avulsas":
    "YouTube, articles, PDFs, writing, and loose phrases",
  Prática: "Practice",
  "Cards com áudio, revisão e treino dos seus erros":
    "Audio cards, review, and drills from your mistakes",
  "O que continua ligado à frase": "What stays connected to the phrase",
  "As partes importantes ficam juntas.": "The important pieces stay together.",
  "Áudio original do conteúdo": "Original audio from real content",
  "Quando a fonte tem áudio, cada card mantém o trecho exato em que a frase foi dita.":
    "When a source has audio, each card keeps the exact clip where the phrase was spoken.",
  "Dados locais por padrão": "Local data by default",
  "Transcrição, áudio gerado, revisões e cards ficam no seu computador. Serviços externos só entram quando você escolhe.":
    "Transcription, generated audio, reviews, and cards stay on your computer. External services are used only when you choose them.",
  "Seus erros viram treino": "Your mistakes become drills",
  "As correções não somem em uma anotação. Elas viram frases para você revisar amanhã.":
    "Corrections don't disappear into a note. They become phrases to review tomorrow.",
  "Reforço do que ainda falha": "Reinforcement for what still breaks",
  "O PhraseLoop acompanha padrões esquecidos e os transforma em prática focada.":
    "PhraseLoop tracks missed patterns and turns them into focused practice.",
  "Inglês real, não frases soltas": "Real English, not isolated examples",
  "Comece com entrevistas, artigos, PDFs e sua própria escrita. O contexto continua ligado ao card.":
    "Start with interviews, articles, PDFs, and your own writing. Context stays connected to the card.",
  "O áudio faz parte da memória": "Audio is part of the memory",
  "Trechos de vídeos mantêm o áudio original; frases de texto podem ganhar áudio gerado no próprio Mac.":
    "Video clips keep their original audio; text phrases can get audio generated on your Mac.",
  "A revisão volta aos seus erros": "Review returns to your mistakes",
  "Revisões e correções trabalham juntas para que erros repetidos virem o próximo alvo de prática.":
    "Reviews and corrections work together so repeated mistakes become the next practice target.",
  "Por dentro do app": "Inside the app",
  "Um espaço no Mac para transformar conteúdo em prática.":
    "A workspace on your Mac for turning content into practice.",
  "As áreas do app são etapas do mesmo ciclo. Assim, cada frase mantém sua origem e encontra o próximo passo de revisão.":
    "The areas of the app are stages of the same loop, so every phrase keeps its source and finds its next review step.",
  "Um caminho real de estudo": "A real study path",
  "Acompanhe uma frase enquanto ela passa pelo app.":
    "Follow one phrase as it moves through the app.",
  "uma frase, o ciclo inteiro": "one phrase, the full loop",
  Descobrir: "Discover",
  "Da fonte para as frases": "From source to phrases",
  "Um vídeo, artigo, PDF ou texto vira trechos que você pode ouvir e guardar.":
    "A video, article, PDF, or text becomes clips you can hear and keep.",
  "Praticar / Estudar": "Practice / Study",
  "Da lembrança ao progresso": "From recall to progress",
  "Cards do dia e padrões difíceis ficam visíveis para cada sessão ter um alvo claro.":
    "Due cards and difficult patterns stay visible so every session has a clear target.",
  "Corrigir / Falar": "Correct / Speech",
  "Da escrita para o treino": "From writing to practice",
  "Corrija sua escrita e reutilize as mesmas frases como material de estudo.":
    "Correct your writing and reuse the same phrases as study material.",
  "Privacidade e controle": "Privacy and control",
  "Nada sai do seu computador sem você escolher.":
    "Nothing leaves your computer unless you choose it.",
  "O PhraseLoop guarda cards e revisões localmente e pode transcrever e gerar áudio no próprio Mac. Serviços na nuvem ficam disponíveis apenas quando você decide usá-los.":
    "PhraseLoop stores cards and reviews locally and can transcribe and generate audio on your Mac. Cloud services are available only when you choose to use them.",
  "Dados locais": "Local data",
  "Nuvem opcional": "Optional cloud",
  "Caminho padrão": "Default path",
  "Transcrição, áudio, cards e histórico de revisão ficam no seu computador.":
    "Transcription, audio, cards, and review history stay on your computer.",
  "Claude ou OpenAI só são usados quando você escolhe um deles.":
    "Claude or OpenAI are used only when you select one of them.",
  "Modelos locais": "Local models",
  "O suporte ao Ollama mantém a criação assistida de cards no seu Mac.":
    "Ollama support keeps assisted card creation on your Mac.",
  "Quer testar com os seus vídeos e os seus erros?":
    "Want to test it with your videos and your mistakes?",
  "A rodada W5 procura pessoas com Mac Apple Silicon que já tentam transformar inglês real em prática. Responda às três perguntas para receber um convite quando sua vaga estiver pronta.":
    "The W5 round is looking for people with Apple Silicon Macs who already try to turn real English into practice. Answer all three questions to receive an invite when a spot is ready.",
  "Próxima rodada": "Next round",
  "Teste o PhraseLoop antes do lançamento.":
    "Test PhraseLoop before launch.",
  "Entre na lista para testar o ciclo completo no seu Mac com seus próprios vídeos, frases e erros.":
    "Join the list to test the full loop on your Mac with your own videos, phrases, and mistakes.",
  "Teste acompanhado": "Moderated test",
  "Criado por": "Created by",
  "Encontre uma frase em uma fonte real.": "Find a phrase in a real source.",
  Guardar: "Keep",
  "Salve a linha que vale lembrar.": "Save the line worth remembering.",
  Revisar: "Review",
  "Crie um card com contexto e áudio.": "Create a card with context and audio.",
  Reforçar: "Reinforce",
  "Pratique de novo quando ela virar um ponto fraco.":
    "Practice it again when it becomes a weak spot.",
};

export function normalizeLandingLanguage(value: unknown): LandingLanguage {
  return value === "en" ? "en" : "pt";
}

export function readLandingLanguage(): LandingLanguage {
  if (typeof window === "undefined") return "pt";
  try {
    memoryLanguage = normalizeLandingLanguage(
      localStorage.getItem(LANDING_LANGUAGE_KEY),
    );
  } catch {
    // Keep the last in-memory selection when storage is unavailable.
  }
  return memoryLanguage;
}

export function saveLandingLanguage(language: LandingLanguage): void {
  memoryLanguage = language;
  try {
    localStorage.setItem(LANDING_LANGUAGE_KEY, language);
  } catch {
    // The selection still works for this page view when storage is unavailable.
  }
  window.dispatchEvent(new Event(LANDING_LANGUAGE_EVENT));
}

export function subscribeLandingLanguage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LANDING_LANGUAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LANDING_LANGUAGE_EVENT, onChange);
  };
}

export function translateLanding(
  language: LandingLanguage,
  portuguese: string,
): string {
  if (language === "pt") return portuguese;
  return ENGLISH_COPY[portuguese] ?? portuguese;
}
