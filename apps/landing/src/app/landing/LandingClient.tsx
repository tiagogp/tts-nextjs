"use client";

import {
  useCallback,
  useEffect,
  type FormEvent,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { CSSProperties } from "react";
import { motion, type Variants } from "motion/react";
import AppHeader from "@/components/app/AppHeader";
import AppProviders from "@/components/app/AppProviders";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import { hoverLift, springSnappy, tapPress } from "@/lib/motion";
import CorrectTab from "@/features/correct/components/CorrectTab";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import StudyTab from "@/features/study/components/StudyTab";
import SpeechTab from "@/features/speech/components/SpeechTab";
import { YourSection } from "./YourSection";
import { AsciiLoop } from "./AsciiLoop";

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.78, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.095, delayChildren: 0.08 } },
};

const listItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.68, ease: [0.22, 1, 0.36, 1] },
  },
};

const ctaReveal: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(14px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.15, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardHover = {
  y: -4,
  transition: springSnappy,
};

const appStageStyle = {
  backgroundImage:
    "linear-gradient(rgba(255, 86, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 86, 0, 0.08) 1px, transparent 1px), linear-gradient(135deg, rgba(255, 86, 0, 0.10), rgba(250, 249, 246, 0) 42%)",
  backgroundSize: "30px 30px, 30px 30px, 100% 100%",
} as CSSProperties;

const warmPatternStyle = {
  backgroundImage:
    "radial-gradient(circle at 18% 0%, rgba(255, 86, 0, 0.13), transparent 34%), linear-gradient(rgba(255, 86, 0, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 86, 0, 0.055) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 28px 28px, 28px 28px",
} as CSSProperties;

const darkPatternStyle = {
  backgroundImage:
    "radial-gradient(circle at 16% 0%, rgba(255, 86, 0, 0.30), transparent 30%), linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px)",
  backgroundSize: "100% 100%, 32px 32px, 32px 32px",
} as CSSProperties;

const flowSteps = [
  {
    label: "YouTube / PDF / article / writing",
    title: "Bring in real English",
    body: "Paste a video, load a document, save an article, or write your own sentences.",
  },
  {
    label: "Transcript / correction",
    title: "Keep what matters",
    body: "Review segments, correct phrasing, and retain the lines worth learning.",
  },
  {
    label: "AI card generation",
    title: "Create active recall",
    body: "Generate cards with context, audio, and prompts tuned to your weak spots.",
  },
  {
    label: "Review / drill",
    title: "Practice the loop",
    body: "Review inside PhraseLoop, then turn weak spots into the next small drill.",
  },
];

const features = [
  {
    title: "Native audio clips from real content",
    body: "Keep the original phrase audio when it exists, or generate clean Kokoro speech locally when it does not.",
  },
  {
    title: "Local-first AI and storage",
    body: "Transcription, TTS, SRS, and saved cards live on your device by default. Claude, OpenAI, and Ollama are explicit choices.",
  },
  {
    title: "Mistakes become drills",
    body: "Corrections do not disappear into notes. They become practice phrases you can review tomorrow.",
  },
  {
    title: "Weakness detection and reinforcement",
    body: "PhraseLoop tracks missed patterns and turns them into focused drills instead of more random review.",
  },
];

const differences = [
  {
    title: "Real English, not sterile examples",
    body: "Start from interviews, articles, PDFs, and your own writing. The cards keep the phrasing tied to real context.",
  },
  {
    title: "Audio is part of the memory",
    body: "Use native clips when source audio exists, or generate Kokoro speech locally for phrases you write or extract from text.",
  },
  {
    title: "Review adapts to your weak spots",
    body: "SRS, corrections, and reinforcement work together so repeated mistakes become the next practice target.",
  },
];

const insidePanels = [
  {
    title: "Discover",
    eyebrow: "Input to phrases",
    body: "A YouTube, article, PDF, or writing source becomes reviewable transcript segments with Keep actions.",
  },
  {
    title: "Practice / Study",
    eyebrow: "Recall to progress",
    body: "Due cards, streak, exposure, and weak patterns stay visible so every session has a target.",
  },
  {
    title: "Correct / Speech",
    eyebrow: "Output to audio",
    body: "Clean up your own writing, generate natural speech, and reuse the same phrases as study material.",
  },
];

const privacyCards = [
  {
    title: "Default path",
    body: "Whisper, Kokoro, cards, audio, and review data stay local.",
    image: "/image-1.png",
  },
  {
    title: "Optional cloud",
    body: "Claude or OpenAI only when you choose them for generation.",
    image: "/image-2.png",
  },
  {
    title: "Local models",
    body: "Ollama support keeps AI-assisted card creation on your machine.",
    image: "/image-3.png",
  },
];

type LandingSectionId = "workflow" | "inside" | "privacy" | "waitlist";

const landingNavItems: Array<{ id: LandingSectionId; label: string }> = [
  { id: "workflow", label: "Workflow" },
  { id: "inside", label: "Inside" },
  { id: "privacy", label: "Privacy" },
  { id: "waitlist", label: "Waitlist" },
];

const platformOptions = [
  "Mac Apple Silicon",
  "Mac Intel",
  "Windows",
  "Linux",
] as const;

const demoDiscoverResult = {
  sourceId: "landing-demo-interview",
  title: "Real interview clip - building consistency",
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

const demoCards = [
  {
    id: "landing-card-1",
    front: "Use 'put it off' to describe delaying something important.",
    back: "I kept putting it off until I finally had a deadline.",
    concept: "put off",
    context: "real interview",
    source: { kind: "phrase" as const, id: "landing-demo-interview-0" },
    createdAt: 1,
  },
  {
    id: "landing-card-2",
    front: "What does 'it turns out' signal in a sentence?",
    back: "It introduces a result or discovery: It turns out consistency matters more than intensity.",
    concept: "it turns out",
    context: "real interview",
    source: { kind: "phrase" as const, id: "landing-demo-interview-1" },
    createdAt: 2,
  },
  {
    id: "landing-card-3",
    front:
      "Say this idea naturally: The difficult part is seeing what you avoid.",
    back: "The hard part is noticing what you avoid saying.",
    concept: "noticing avoidance",
    context: "speaking practice",
    source: { kind: "phrase" as const, id: "landing-demo-interview-2" },
    createdAt: 3,
  },
];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase text-accent">
      {children}
    </p>
  );
}

function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={sectionReveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.22 }}
    >
      {children}
    </motion.div>
  );
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

function demoStreamResponse() {
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
        send({ type: "done", result: demoDiscoverResult });
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

function demoFetchResponse(pathname: string, init?: RequestInit) {
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
          detail: "Demo local model ready.",
        },
        {
          kind: "local",
          label: "Local heuristics",
          available: true,
          state: "connected",
          detail: "Offline fallback ready.",
        },
        {
          kind: "claude",
          label: "Claude",
          available: false,
          state: "missing",
          detail: "Cloud providers are opt-in.",
        },
        {
          kind: "openai",
          label: "OpenAI",
          available: false,
          state: "missing",
          detail: "Cloud providers are opt-in.",
        },
      ],
      writable: true,
      storage: "demo",
      version: 1,
    });
  }

  if (pathname === "/api/settings/test") {
    return jsonResponse({ ok: true, detail: "Demo connection ready." });
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
  if (pathname === "/api/discover") return demoStreamResponse();
  if (
    pathname === "/api/discover/article" ||
    pathname === "/api/discover/pdf"
  ) {
    return jsonResponse({ ...demoDiscoverResult, hasAudio: false });
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
    return jsonResponse({
      cards: demoCards,
      count: demoCards.length,
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
          rationale: "Agree is already a verb in English.",
          context: "discussion",
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
    return jsonResponse({ cards: demoCards });
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

function useLandingDemoApi() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const demoResponse = demoFetchResponse(url.pathname, init);
      if (demoResponse) return demoResponse;
      if (url.origin === "http://127.0.0.1:8765") {
        return jsonResponse({ result: [12345, 12346, 12347], error: null });
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
}

function DemoTabContent({
  tab,
  onOpenSettings,
  onOpenDiscover,
  onOpenPractice,
  onOpenConversation,
  onOpenCorrect,
}: {
  tab: HomeTab;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  onOpenConversation: () => void;
  onOpenCorrect: () => void;
}) {
  if (tab === "discover") {
    return (
      <DiscoverTab
        onOpenSettings={onOpenSettings}
        onStudyNow={onOpenPractice}
      />
    );
  }

  if (tab === "study") {
    return (
      <StudyTab
        onDiscover={onOpenDiscover}
        onConversation={onOpenConversation}
      />
    );
  }

  if (tab === "correct") {
    return (
      <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} />
    );
  }

  return <SpeechTab />;
}

// The landing preview has no "Hoje" home surface; it opens straight on Discover.
const LANDING_TABS = HOME_TABS.filter((item) => item.id !== "hoje");

function RealAppDemo() {
  useLandingDemoApi();
  const [tab, setTab] = useState<HomeTab>("discover");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const changeTab = useCallback((next: HomeTab) => {
    setTab(next);
    setSettingsOpen(false);
  }, []);

  return (
    <motion.div
      className="mx-auto w-full max-w-7xl overflow-hidden rounded-lg border border-line-strong bg-surface"
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between border-b border-line bg-[#f3eee7] px-3 py-2 dark:bg-[#2a2724] sm:px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b4a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9b86f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#62b36f]" />
        </div>
        <p className="text-xs font-medium text-[#5f5a52] dark:text-[#d8d3ca]">
          Interactive preview with sample data
        </p>
      </div>
      <AppProviders>
        <div className="flex h-[680px] flex-col overflow-hidden bg-surface sm:h-[720px] lg:h-[660px]">
          <AppHeader
            activeTab={tab}
            onTabChange={changeTab}
            settingsOpen={settingsOpen}
            onSettingsOpen={() => setSettingsOpen(true)}
            tabs={LANDING_TABS}
          />
          <main className="min-h-0 flex-1">
            {settingsOpen ? (
              <div
                className="h-full overflow-y-auto pb-12 app-scroll-region"
                style={{ overscrollBehavior: "auto" }}
              >
                <div className="mx-auto max-w-5xl px-4 py-5">
                  <SettingsScreen
                    onBack={() => setSettingsOpen(false)}
                    showAdvancedAi={false}
                  />
                </div>
              </div>
            ) : (
              LANDING_TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <section
                    key={item.id}
                    hidden={!active}
                    aria-labelledby={`landing-tab-${item.id}`}
                    role="tabpanel"
                    tabIndex={0}
                    className="h-full overflow-y-auto app-scroll-region"
                    style={{ overscrollBehavior: "auto" }}
                  >
                    <motion.div
                      className="mx-auto max-w-5xl px-4 pb-14 pt-5"
                      initial={false}
                      animate={
                        active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
                      }
                      transition={springSnappy}
                    >
                      <DemoTabContent
                        tab={item.id}
                        onOpenSettings={() => setSettingsOpen(true)}
                        onOpenDiscover={() => changeTab("discover")}
                        onOpenPractice={() => changeTab("study")}
                        onOpenConversation={() => changeTab("discover")}
                        onOpenCorrect={() => changeTab("correct")}
                      />
                    </motion.div>
                  </section>
                );
              })
            )}
          </main>
        </div>
      </AppProviders>
    </motion.div>
  );
}

function AppMockup() {
  return <RealAppDemo />;
}

function MiniScreen({ title }: { title: string }) {
  return (
    <motion.div
      className="rounded-lg border border-line bg-card p-3"
      whileHover={cardHover}
      transition={springSnappy}
    >
      <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
        <p className="text-sm font-semibold text-ink">PhraseLoop.</p>
        <p className="text-xs text-ink-muted">{title}</p>
      </div>
      {title === "Discover" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1 text-center text-[11px] font-medium">
            <span className="rounded bg-accent py-1 text-white">YouTube</span>
            <span className="rounded border border-line py-1 text-ink-muted">
              Article
            </span>
            <span className="rounded border border-line py-1 text-ink-muted">
              PDF
            </span>
          </div>
          <motion.div
            className="rounded border border-line bg-surface p-2 text-xs text-ink"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            Consistency matters more than intensity.
          </motion.div>
          <motion.div
            className="rounded border border-line bg-surface p-2 text-xs text-ink"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
          >
            I kept putting it off for weeks.
          </motion.div>
        </div>
      ) : null}
      {title === "Practice" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {["24 due", "418 cards", "9d"].map((item) => (
              <span
                key={item}
                className="rounded border border-line bg-surface p-2 text-center text-xs font-semibold text-ink"
              >
                {item}
              </span>
            ))}
          </div>
          <motion.div
            className="rounded border border-line bg-surface p-3"
            animate={{ borderColor: ["#dedbd6", "#ff5600", "#dedbd6"] }}
            transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.2 }}
          >
            <p className="text-sm font-semibold text-ink">turns out</p>
            <p className="mt-1 text-xs text-ink-muted">
              Use it in a sentence about a recent surprise.
            </p>
          </motion.div>
        </div>
      ) : null}
      {title === "Correct" ? (
        <div className="space-y-2">
          <div className="rounded border border-line bg-surface p-2 text-xs text-ink-muted">
            I am agree with this idea.
          </div>
          <div className="rounded border border-line bg-surface p-2 text-xs text-ink">
            I agree with this idea.
          </div>
          <motion.div
            className="rounded bg-accent/10 p-2 text-xs font-semibold text-accent"
            animate={{ opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Generate speech with Kokoro
          </motion.div>
        </div>
      ) : null}
    </motion.div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<
    (typeof platformOptions)[number] | ""
  >("");
  const [workflow, setWorkflow] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, platform, workflow }),
      });
      if (!response.ok) throw new Error("waitlist failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase text-[#d8d3ca]">
          Email
        </span>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded border border-white/15 bg-white/8 px-3 py-2 text-sm text-white placeholder:text-[#8f8980] focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="you@email.com"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-[#d8d3ca]">
          Which computer do you use?
        </span>
        <select
          required
          value={platform}
          onChange={(event) =>
            setPlatform(
              event.target.value as (typeof platformOptions)[number] | "",
            )
          }
          className="mt-1 w-full rounded border border-white/15 bg-[#151515] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">Choose an option</option>
          {platformOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-[#d8d3ca]">
          How do you turn English content into practice today?
        </span>
        <textarea
          required
          minLength={8}
          value={workflow}
          onChange={(event) => setWorkflow(event.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded border border-white/15 bg-white/8 px-3 py-2 text-sm text-white placeholder:text-[#8f8980] focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="E.g. I save phrases in Anki, write summaries, keep a notebook..."
        />
      </label>

      <button
        type="submit"
        disabled={status === "saving" || status === "saved"}
        className="inline-flex w-full items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "saving"
          ? "Sending..."
          : status === "saved"
            ? "You're on the list"
            : "Join the waitlist"}
      </button>

      {status === "error" && (
        <p className="text-xs text-[#ffb199]">
          Could not save right now. Try again in a few seconds.
        </p>
      )}
      {status === "saved" && (
        <p className="text-xs text-[#b7e4bf]">
          Thanks. I am prioritizing invites for Mac Apple Silicon users in this
          round.
        </p>
      )}
    </form>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<LandingSectionId | null>(
    null,
  );
  // Header animations stay off until it has snapped to the real scroll
  // position once. Otherwise a reload while scrolled springs the full-width
  // header down into the compact pill ("gets huge then shrinks").
  const [headerReady, setHeaderReady] = useState(false);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";

    const updateHeaderState = () => {
      const isScrolled = window.scrollY > 28;
      setScrolled(isScrolled);

      let current: LandingSectionId | null = null;

      for (const { id } of landingNavItems) {
        const section = document.getElementById(id);

        if (section && section.getBoundingClientRect().top <= 150) {
          current = id;
        }
      }

      setActiveSection(current);
    };

    updateHeaderState();
    const raf = requestAnimationFrame(() => setHeaderReady(true));

    window.addEventListener("scroll", updateHeaderState, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updateHeaderState);
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);
  const handleSectionLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, sectionId: LandingSectionId) => {
      setActiveSection(sectionId);

      const target = document.getElementById(sectionId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${sectionId}`);
    },
    [],
  );

  // Spring once the header has measured the real scroll position; snap before
  // that so the first resolved state never animates on load.
  const headerTransition = headerReady
    ? { type: "spring" as const, stiffness: 220, damping: 28 }
    : { duration: 0 };

  return (
    <main className="min-h-screen bg-surface text-ink">
      <motion.header
        className="fixed inset-x-0 top-0 z-50 px-4 pointer-events-none sm:px-6 lg:px-8"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          initial={false}
          className="pointer-events-auto mx-auto mt-4 flex w-full max-w-[1120px] items-center justify-between gap-4 rounded-[14px] border px-4 py-3"
          animate={{
            maxWidth: scrolled ? 960 : 1120,
            marginTop: scrolled ? 10 : 16,
            padding: scrolled ? "0.55rem 1.35rem" : "0.75rem 1rem",
            borderRadius: scrolled ? 999 : 14,
            backgroundColor: scrolled
              ? "color-mix(in srgb, var(--surface-card) 92%, transparent)"
              : "rgba(255, 255, 255, 0)",
            borderColor: scrolled ? "var(--border)" : "rgba(255, 255, 255, 0)",
            boxShadow: scrolled ? "var(--shadow-soft)" : "0 0 0 rgb(0 0 0 / 0)",
            backdropFilter: scrolled ? "blur(14px)" : "blur(0px)",
          }}
          transition={headerTransition}
        >
          <a href="#top" className="flex items-center">
            <motion.span
              className="brand-wordmark font-normal leading-none text-ink"
              initial={{ fontSize: "1.28rem" }}
              animate={{ fontSize: scrolled ? "1.08rem" : "1.28rem" }}
              transition={headerTransition}
            >
              PhraseLoop
            </motion.span>
            <motion.span
              className="brand-wordmark font-normal leading-none text-fin"
              initial={{ fontSize: "1.28rem" }}
              animate={{ fontSize: scrolled ? "1.08rem" : "1.28rem" }}
              transition={headerTransition}
            >
              .
            </motion.span>
          </a>

          <nav
            className="hidden items-center gap-2 text-sm font-medium text-ink-muted sm:flex"
            aria-label="Landing navigation"
          >
            {landingNavItems.map((item) => {
              const active = activeSection === item.id;

              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={active ? "location" : undefined}
                  onClick={(event) => handleSectionLinkClick(event, item.id)}
                  className={`relative rounded px-2.5 py-1.5 transition-colors ${
                    active ? "text-ink" : "hover:bg-accent/8 hover:text-ink"
                  }`}
                >
                  {item.label}

                  {active ? (
                    <motion.span
                      layoutId="landing-nav-active"
                      className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-accent"
                      transition={springSnappy}
                    />
                  ) : null}
                </a>
              );
            })}
          </nav>

          <motion.a
            href="/api/download/macos"
            whileHover={hoverLift}
            whileTap={tapPress}
            className="rounded border border-ink bg-ink px-3.5 py-2 text-sm font-semibold text-surface"
          >
            Download
          </motion.a>
        </motion.div>
      </motion.header>

      <section className="px-4 pb-12 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div id="top" className="scroll-mt-28 space-y-8">
            <motion.div
              className="relative mx-auto max-w-4xl text-center"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              <motion.div
                className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
                variants={listItem}
              >
                <AsciiLoop className="text-[clamp(7px,1.4vw,12px)]" />
              </motion.div>
              <motion.p
                className="mb-4 text-sm font-semibold text-accent"
                variants={listItem}
              >
                Real English. Original audio. Ready to review.
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
                Paste a YouTube video. In 2 minutes, the best phrases become
                review cards with the original audio — and your own mistakes
                become tomorrow&apos;s practice.
              </motion.p>
              <motion.div
                className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"
                variants={ctaReveal}
              >
                <motion.a
                  href="/api/download/macos"
                  whileHover={hoverLift}
                  whileTap={tapPress}
                  className="inline-flex items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white"
                >
                  Download for macOS
                </motion.a>
                <motion.a
                  href="#workflow"
                  onClick={(event) => handleSectionLinkClick(event, "workflow")}
                  whileHover={hoverLift}
                  whileTap={tapPress}
                  className="inline-flex items-center justify-center rounded border border-line bg-card px-5 py-3 text-sm font-semibold text-ink"
                >
                  See how it works
                </motion.a>
              </motion.div>
              <motion.p
                className="mt-4 text-sm text-ink-muted"
                variants={listItem}
              >
                For A2-B1 learners studying on their own: the step before Anki,
                right on your Mac.
              </motion.p>
            </motion.div>

            <motion.div
              className="rounded-lg border border-line bg-[#f3eee7] p-2 dark:bg-[#1f1d1b] sm:p-4"
              style={appStageStyle}
              variants={listItem}
              initial="hidden"
              animate="show"
            >
              <AppMockup />
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
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {item.body}
                  </p>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-24 border-y border-[#2b2926] bg-[#111111] px-4 py-16 text-[#faf9f6] sm:px-6 lg:px-8"
        style={darkPatternStyle}
      >
        <Reveal className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase text-accent">
            From real input to lasting recall
          </p>
          <div className="mb-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] sm:text-5xl">
              One loop from source material to usable English.
            </h2>
            <p className="text-lg leading-8 text-[#d8d3ca]">
              PhraseLoop is not a voice generator with a study feature bolted
              on. It is a local learning workflow: find language, keep the
              useful parts, turn them into active recall, then reinforce what
              still breaks under pressure.
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
                <p className="brand-wordmark text-4xl leading-none text-accent">
                  0{index + 1}
                </p>
                <p className="mt-5 text-xs font-semibold uppercase text-[#d8d3ca]">
                  {step.label}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#d8d3ca]">
                  {step.body}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </Reveal>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <SectionLabel>The complete learning loop</SectionLabel>
              <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] text-ink sm:text-5xl">
                More than text to speech.
              </h2>
            </div>
            <p className="text-lg leading-8 text-ink-soft">
              TTS gives you audio. PhraseLoop gives you a closed practice
              system: real input, selected phrases, generated cards,
              spaced-repetition review, and drills based on what you miss.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              className="rounded-lg border border-line bg-card p-6 sm:p-8"
              style={warmPatternStyle}
              whileHover={cardHover}
            >
              <p className="text-sm font-semibold text-accent">
                The product difference
              </p>
              <h3 className="brand-wordmark mt-4 text-3xl font-normal leading-[0.98] text-ink sm:text-4xl">
                You do not study random sentences. You study phrases you already
                met, heard, kept, and need again.
              </h3>
              <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted">
                That context makes recall stick. The app keeps the source, the
                audio, the card, and the weakness signal connected instead of
                scattering them across tools.
              </p>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Input", "YouTube, articles, PDFs, writing, loose phrases"],
                ["Output", "Audio cards, app practice, mistake drills"],
              ].map(([label, body]) => (
                <motion.div
                  key={label}
                  className="rounded-lg border border-line bg-card p-5"
                  whileHover={cardHover}
                >
                  <p className="text-xs font-semibold uppercase text-accent">
                    {label}
                  </p>
                  <p className="mt-3 text-xl font-semibold leading-7 text-ink">
                    {body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-12 max-w-2xl">
            <SectionLabel>What stays with the phrase</SectionLabel>
            <h3 className="brand-wordmark text-3xl font-normal leading-[0.98] text-ink sm:text-4xl">
              The core pieces stay connected.
            </h3>
          </div>
          <motion.div
            className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {features.map((feature) => (
              <motion.article
                key={feature.title}
                className="rounded-lg border border-line bg-card p-5"
                variants={listItem}
                whileHover={cardHover}
              >
                <motion.div
                  className="mb-5 h-1.5 w-10 rounded bg-accent"
                  initial={{ width: 18 }}
                  whileInView={{ width: 40 }}
                  viewport={{ once: true }}
                />
                <h3 className="text-xl font-semibold leading-7 text-ink">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  {feature.body}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </Reveal>
      </section>

      <section
        id="inside"
        className="scroll-mt-24 border-y border-line bg-card px-4 py-16 sm:px-6 lg:px-8"
      >
        <Reveal className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Inside the app</SectionLabel>
            <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] text-ink sm:text-5xl">
              A desktop workspace for turning input into practice.
            </h2>
            <p className="mt-4 text-lg leading-8 text-ink-soft">
              The tabs are not separate tools. They are the stages of the same
              loop, so the app always knows where a phrase came from and what
              should happen next.
            </p>
          </div>
          <div className="mt-10">
            <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    A real study path
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    Follow one phrase as it moves through the app.
                  </p>
                </div>
                <span className="rounded border border-line bg-card px-3 py-1.5 text-xs font-semibold text-accent">
                  one phrase, full loop
                </span>
              </div>
              <YourSection />
            </div>
            <motion.div
              className="mt-6 grid gap-4 md:grid-cols-3"
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.22 }}
            >
              {insidePanels.map((panel) => (
                <motion.article
                  key={panel.title}
                  variants={listItem}
                  className="flex h-full flex-col rounded-lg border border-line bg-surface p-4"
                  whileHover={cardHover}
                >
                  <p className="text-xs font-semibold uppercase text-accent">
                    {panel.eyebrow}
                  </p>
                  <h3 className="brand-wordmark mt-2 text-3xl font-normal leading-none text-ink">
                    {panel.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-ink-muted">
                    {panel.body}
                  </p>
                  <div className="mt-5">
                    <MiniScreen title={panel.title.split(" / ")[0]} />
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </div>
        </Reveal>
      </section>

      <section id="privacy" className="scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
        <Reveal className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <SectionLabel>Privacy and control</SectionLabel>
            <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] text-ink sm:text-5xl">
              Nothing leaves your device unless you choose a cloud provider.
            </h2>
            <p className="mt-4 text-lg leading-8 text-ink-soft">
              PhraseLoop is built around local storage, local Kokoro TTS, local
              transcription, and SRS data you own. Cloud AI is available when
              you explicitly select Claude or OpenAI; Ollama is supported for a
              local model workflow.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                "Kokoro TTS",
                "Whisper",
                "Local storage",
                "Ollama",
                "Opt-in cloud",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <motion.div
            className="grid gap-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            {privacyCards.map(({ title, body, image }) => (
              <motion.div
                key={title}
                className="min-h-32 rounded-lg border border-line bg-card bg-cover bg-center p-5"
                style={
                  {
                    backgroundImage: `linear-gradient(45deg, var(--surface-card) 0%, color-mix(in srgb, var(--surface-card) 96%, transparent) 44%, color-mix(in srgb, var(--surface-card) 64%, transparent) 72%, color-mix(in srgb, var(--surface-card) 20%, transparent) 100%), linear-gradient(180deg, color-mix(in srgb, var(--surface-card) 42%, transparent), color-mix(in srgb, var(--surface-card) 18%, transparent)), url(${image})`,
                  } as CSSProperties
                }
                variants={listItem}
                whileHover={cardHover}
              >
                <div className="max-w-[22rem]">
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    {body}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Reveal>
      </section>

      <section
        id="waitlist"
        className="scroll-mt-24 border-t border-[#2b2926] bg-[#111111] px-4 py-16 text-[#faf9f6] sm:px-6 lg:px-8"
        style={darkPatternStyle}
      >
        <Reveal className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase text-accent">
              Waitlist
            </p>
            <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] sm:text-5xl">
              Want to test it with your videos and your mistakes?
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[#d8d3ca]">
              The W5 round is looking for Mac Apple Silicon users who already
              try to turn real English into practice. Answer the two questions
              so I know if you fit this group.
            </p>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/6 p-5">
            <WaitlistForm />
          </div>
        </Reveal>
      </section>

      <section
        id="download"
        className="scroll-mt-24 border-t border-[#2b2926] bg-[#111111] px-4 py-16 text-[#faf9f6] sm:px-6 lg:px-8"
        style={darkPatternStyle}
      >
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase text-accent">
            Download
          </p>
          <h2 className="brand-wordmark text-4xl font-normal leading-[0.95] sm:text-5xl">
            Start your English loop today.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-[#d8d3ca]">
            Download the DMG, drag PhraseLoop to Applications, and turn the
            next video you watch into cards with real audio.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              "macOS Apple Silicon",
              "Runtime bundled",
              "Drag-to-install",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#d8d3ca]"
              >
                {item}
              </span>
            ))}
          </div>
          <motion.a
            href="/api/download/macos"
            whileHover={hoverLift}
            whileTap={tapPress}
            className="mt-7 inline-flex items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white"
          >
            Download PhraseLoop.dmg
          </motion.a>
          <p className="mt-6 text-xs text-[#d8d3ca]">
            Created by{" "}
            <a
              href="https://github.com/tiagogp"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white underline decoration-accent underline-offset-4 transition-colors hover:text-accent"
            >
              Tiago GP
            </a>
          </p>
        </Reveal>
      </section>
    </main>
  );
}
