# 90-Second Demo Video — Script & Shot List

Phase 4 trust artifact (see [validation-action-plan.md](../validation-action-plan.md)).
One recording serves both the landing page and community posts. Everything on screen must
be real: real loop, real native audio, real own-source import — no mockups, no sped-up
fakes beyond honest jump cuts.

## Rules

- Record on a clean install so the screens match what a new user sees.
- Interface in PT-BR (A2 profile) — the ICP watches this in Portuguese.
- System audio ON: the native clip and the sliced card audio are the differentiator;
  they must be heard, not described.
- No voiceover jargon: never "deck", "provider", "APKG", "curation".
- Keep total runtime 80-95 s. If a cut runs long, trim the middle (import wait),
  never the payoff (the error card on day 2).

## Shot List

| # | Time | Screen | What happens | Line (PT-BR, VO or caption) |
| --- | --- | --- | --- | --- |
| 1 | 0-8s | Hoje (first launch) | Pitch visible on the first screen | "Cole um vídeo do YouTube. As melhores frases viram cards com o áudio original — e seus erros viram o treino de amanhã." |
| 2 | 8-22s | Lição guiada | Play one native clip; audio audible | "Você ouve inglês de verdade — não voz de robô." |
| 3 | 22-32s | Lição guiada | Save one phrase; immediate review with the same audio | "Salvou? Já revisa com o mesmo áudio." |
| 4 | 32-45s | Escrever + corrigir | Type a sentence with a real mistake; correction appears; save it | "Você escreve, o app corrige — e o erro vira um card." |
| 5 | 45-65s | Descobrir | Paste a real YouTube URL (short, public, <10 min); import runs (jump cut allowed); phrases appear with original audio | "Agora com um vídeo SEU. O áudio original é cortado direto da fonte." |
| 6 | 65-80s | Estudar (day 2 state) | The return moment: "3 cards para hoje — 1 veio do seu erro de ontem"; grade one card | "No dia seguinte: seus erros de ontem são o treino de hoje." |
| 7 | 80-90s | Hoje | Calm close on the app | "PhraseLoop. Inglês real, no seu Mac, em português." |

## Recording Checklist

- [ ] Clean install (localStorage **and** IndexedDB wiped; models pre-downloaded so shot 5 has no model wall).
- [ ] Shot 6 needs a day-2 state: prepare a machine/profile that ran the loop yesterday, or system-clock the state honestly and disclose nothing false on screen.
- [ ] 1080p minimum, app window only, cursor visible.
- [ ] Audio levels: native clip clearly audible over any VO.
- [ ] Export with burned-in PT-BR captions (most viewers watch muted first — but the audio is the proof, so the captions must invite sound-on: "🔊 áudio original").

## Publishing (the _Done when_)

- [ ] Video embedded on the landing page, replacing the interactive simulation as the primary proof (`apps/landing`).
- [ ] Same file used in community posts (Phase 2 demand test).
- [ ] Landing page still loads fast: compress to <10 MB or host as streamed video, never a GIF.

## Honesty Gate

Do not record shot 2 with Kokoro audio while claiming "não voz de robô" — this shot is
**blocked** until the Phase 1 "real native clips" item ships. If real clips are not in the
bundled lesson yet, either record shot 2 with an own-source import (real audio by
construction) or hold the video.
