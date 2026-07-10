import {
  translateLanding,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";

function demoDiscoverResult(language: LandingLanguage) {
  return {
    sourceId: "landing-demo-interview",
    title: translateLanding(
      language,
      "Trecho de entrevista — criando consistência",
    ),
    hasAudio: true,
    segments: [
      {
        text: "I kept putting it off until I finally had a deadline.",
        startMs: 42000,
        endMs: 47000,
      },
      {
        text: "It turns out consistency matters more than intensity.",
        startMs: 78000,
        endMs: 82500,
      },
      {
        text: "The hard part is noticing what you avoid saying.",
        startMs: 127000,
        endMs: 132500,
      },
      {
        text: "Once I made it part of my routine, it stopped feeling like effort.",
        startMs: 151000,
        endMs: 157000,
      },
    ],
  };
}

function demoCards(language: LandingLanguage) {
  return [
    {
      id: "landing-card-1",
      front:
        language === "pt"
          ? "Use 'put it off' para falar de algo importante que você adiou."
          : "Use 'put it off' to describe delaying something important.",
      back: "I kept putting it off until I finally had a deadline.",
      concept: "put off",
      context: language === "pt" ? "entrevista real" : "real interview",
      source: { kind: "phrase" as const, id: "landing-demo-interview-0" },
      createdAt: 1,
    },
    {
      id: "landing-card-2",
      front:
        language === "pt"
          ? "O que 'it turns out' sinaliza em uma frase?"
          : "What does 'it turns out' signal in a sentence?",
      back: "It introduces a result or discovery: It turns out consistency matters more than intensity.",
      concept: "it turns out",
      context: language === "pt" ? "entrevista real" : "real interview",
      source: { kind: "phrase" as const, id: "landing-demo-interview-1" },
      createdAt: 2,
    },
    {
      id: "landing-card-3",
      front:
        language === "pt"
          ? "Diga esta ideia de forma natural: The difficult part is seeing what you avoid."
          : "Say this idea naturally: The difficult part is seeing what you avoid.",
      back: "The hard part is noticing what you avoid saying.",
      concept: "noticing avoidance",
      context: language === "pt" ? "prática de fala" : "speaking practice",
      source: { kind: "phrase" as const, id: "landing-demo-interview-2" },
      createdAt: 3,
    },
  ];
}

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

function demoStreamResponse(language: LandingLanguage) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "progress", percent: 35, stage: "download" });
      window.setTimeout(
        () => send({ type: "progress", percent: 82, stage: "transcribe" }),
        260,
      );
      window.setTimeout(() => {
        send({ type: "done", result: demoDiscoverResult(language) });
        controller.close();
      }, 620);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

export function demoFetchResponse(
  pathname: string,
  init: RequestInit | undefined,
  language: LandingLanguage,
) {
  if (pathname === "/api/settings") {
    if (init?.method === "PATCH") return jsonResponse({ ok: true, version: 2 });
    return jsonResponse({
      defaultProvider: "ollama",
      ollama: {
        baseUrl: "http://localhost:11434",
        model: "llama3.2",
        models: ["llama3.2", "qwen2.5"],
      },
      providers: [
        {
          kind: "ollama",
          label: "Ollama",
          available: true,
          state: "connected",
          detail:
            language === "pt"
              ? "Modelo local da demonstração pronto."
              : "Demo local model ready.",
        },
        {
          kind: "local",
          label: language === "pt" ? "Correção local" : "Local correction",
          available: true,
          state: "connected",
          detail:
            language === "pt"
              ? "Alternativa sem internet pronta."
              : "Offline fallback ready.",
        },
        {
          kind: "claude",
          label: "Claude",
          available: false,
          state: "missing",
          detail:
            language === "pt"
              ? "Serviços na nuvem são opcionais."
              : "Cloud services are optional.",
        },
        {
          kind: "openai",
          label: "OpenAI",
          available: false,
          state: "missing",
          detail:
            language === "pt"
              ? "Serviços na nuvem são opcionais."
              : "Cloud services are optional.",
        },
      ],
      writable: true,
      storage: "demo",
      version: 1,
    });
  }

  if (pathname === "/api/settings/test") {
    return jsonResponse({
      ok: true,
      detail:
        language === "pt"
          ? "Conexão da demonstração pronta."
          : "Demo connection ready.",
    });
  }

  if (pathname === "/api/status") {
    return jsonResponse({
      downloading_model: false,
      downloading_whisper: false,
      kokoro_installed: true,
      loading_kokoro: false,
      downloading_kokoro: false,
    });
  }

  if (pathname === "/api/models/kokoro") return jsonResponse({ ok: true });
  if (pathname === "/api/discover") return demoStreamResponse(language);
  if (
    pathname === "/api/discover/article" ||
    pathname === "/api/discover/pdf"
  ) {
    return jsonResponse({ ...demoDiscoverResult(language), hasAudio: false });
  }
  if (pathname.startsWith("/api/discover/audio/")) {
    return new Response(
      new Blob(["PhraseLoop demo audio"], { type: "audio/wav" }),
    );
  }

  if (pathname === "/api/cards/mine") {
    return jsonResponse({ selectedIndexes: [0, 1, 2], count: 3 });
  }

  if (pathname === "/api/cards/generate") {
    const cards = demoCards(language);
    return jsonResponse({
      cards,
      count: cards.length,
      filename: "PhraseLoop-demo.apkg",
      apkg: btoa("PhraseLoop demo deck"),
    });
  }

  if (pathname === "/api/cards/correct") {
    return jsonResponse({
      events: [
        {
          id: "landing-error-1",
          original: "I am agree with this idea.",
          corrected: "I agree with this idea.",
          errorTypes: ["other"],
          sourceLang: "pt",
          targetLang: "en",
          rationale:
            language === "pt"
              ? "Agree já é um verbo em inglês."
              : "Agree is already a verb in English.",
          context: language === "pt" ? "conversa" : "discussion",
          createdAt: Date.now(),
        },
      ],
    });
  }

  if (pathname === "/api/transcribe") {
    return jsonResponse({
      text: "I kept putting it off, but now I practice every day.",
    });
  }

  if (pathname === "/api/cards/reinforce") {
    return jsonResponse({ cards: demoCards(language) });
  }

  if (pathname === "/api/plan" || pathname === "/api/plan/adapt") {
    return jsonResponse({ days: [], newAvailabilityMinutes: 20 });
  }

  if (pathname === "/api/tts") {
    return new Response(
      new Blob(["PhraseLoop demo speech"], { type: "audio/wav" }),
    );
  }

  return null;
}
