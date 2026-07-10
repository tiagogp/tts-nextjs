"use client";

import { useState, type FormEvent } from "react";
import {
  translateLanding,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";
import {
  WAITLIST_PLATFORMS,
  type WaitlistPlatform,
} from "@landing/lib/waitlist";
import { submitWaitlistEntry } from "@landing/services/waitlist";

export function WaitlistForm({ language }: { language: LandingLanguage }) {
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<WaitlistPlatform | "">("");
  const [workflow, setWorkflow] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!platform) {
      setStatus("error");
      return;
    }

    setStatus("saving");
    try {
      await submitWaitlistEntry({
        email,
        platform,
        workflow,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase text-ink-soft">
          Email
        </span>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="voce@email.com"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-ink-soft">
          {translateLanding(language, "Qual computador você usa?")}
        </span>
        <select
          required
          value={platform}
          onChange={(event) =>
            setPlatform(event.target.value as WaitlistPlatform | "")
          }
          className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">
            {translateLanding(language, "Selecione uma opção")}
          </option>
          {WAITLIST_PLATFORMS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase text-ink-soft">
          {translateLanding(
            language,
            "Como você transforma conteúdo em inglês em prática hoje?",
          )}
        </span>
        <textarea
          required
          minLength={8}
          maxLength={2_000}
          rows={4}
          value={workflow}
          onChange={(event) => setWorkflow(event.target.value)}
          className="mt-1 w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder={translateLanding(
            language,
            "Ex.: salvo frases no Anki, anoto em um caderno, só assisto ao vídeo…",
          )}
        />
      </label>

      <button
        type="submit"
        disabled={status === "saving" || status === "saved"}
        className="inline-flex w-full items-center justify-center rounded border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "saving"
          ? translateLanding(language, "Enviando...")
          : status === "saved"
            ? translateLanding(language, "Você está na lista")
            : translateLanding(language, "Entrar na lista de espera")}
      </button>

      <div aria-live="polite">
        {status === "error" && (
          <p className="text-xs text-[#c73a1d]">
            {translateLanding(
              language,
              "Não foi possível salvar agora. Tente de novo em alguns segundos.",
            )}
          </p>
        )}
        {status === "saved" && (
          <p className="text-xs text-[#2f7d3d]">
            {translateLanding(
              language,
              "Obrigado. Nesta rodada, os primeiros convites vão para quem usa Mac com Apple Silicon.",
            )}
          </p>
        )}
      </div>
    </form>
  );
}
