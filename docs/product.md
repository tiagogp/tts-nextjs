# PhraseLoop - Produto, Pesquisa e Roadmap

Este e um dos dois documentos canonicos do projeto. Ele concentra direcao de produto,
metodo de aprendizagem, validacao, pesquisa e roadmap de conteudo.

Use:

- [README.md](../README.md) para setup, execucao e visao publica do app.
- [docs/README.md](README.md) para arquitetura, implementacao, design e backlog tecnico.
- Este arquivo para todas as decisoes de produto e aprendizagem.

## Produto Em Uma Frase

PhraseLoop ajuda brasileiros A2-B1 que estudam ingles sozinhos, ja consomem conteudo real e
acham criacao de cards manual demais a transformar esse ingles e seus proprios erros em revisao
diaria com audio nativo no Mac.

Essa frase e a fonte de verdade para README, onboarding, landing copy, release notes e roadmap.

## Tese

Ferramentas de idioma tendem a otimizar consumo passivo ou memorizacao isolada. PhraseLoop
aposta em um ciclo fechado:

```text
capturar -> estudar -> produzir -> reforcar
```

O usuario traz material real ou produz linguagem propria. O app transforma isso em frases
estudaveis, agenda revisoes, detecta fraquezas e gera reforco a partir dos erros reais.

## Guardrails De Launch

Antes do launch amplo, as decisoes de escopo, segmento inicial e monetizacao devem seguir sinais
observados de ativacao (`first_run_started` -> `first_loop_completed`), explain-back,
diferenciacao espontanea e retorno D+1/D+7.

Decisoes de launch:

1. Reduzir a experiencia visivel a um loop guiado: ouvir um clipe curto curado -> salvar uma frase
   -> revisar agora -> escrever uma frase -> corrigir -> salvar a correcao para amanha.
2. Fazer os diferenciais reais aparecerem na primeira sessao: criacao de cards com pouca friccao
   e erros pessoais virando drills de revisao. Audio original continua disponivel quando o usuario
   traz uma fonte com audio, mas nao e requisito do loop bundled.
3. Primeiro cliente escolhido para launch: autodidata A2-B1 / Anki-adjacent que traz fontes reais,
   entende revisao e sente a dor de transformar material real em pratica.
4. Empacotar monetizacao em uma dor concreta, nao em um pacote generico de possibilidades.

## Usuario-Alvo

O recorte de v1 e deliberadamente estreito. O ICP de launch e:

- Brasileiro falante de portugues aprendendo ingles.
- Nivel A2-B1.
- Ja estuda sozinho, assiste/le textos em ingles e tentou Anki, flashcards ou um fluxo parecido.
- Tem Mac Apple Silicon e aceita desktop como primeiro ambiente.
- Sente que criar cards, limpar frases, adicionar audio e revisar erros manualmente e trabalhoso.

O primeiro cliente de launch e **autodidata A2-B1 / Anki-adjacent**: quem traz fontes reais,
entende revisao e valoriza reduzir o trabalho manual de transformar material em pratica diaria.
O iniciante A1 continua suportado por licoes bundled, mas nao e a narrativa primaria de launch.

Nao servimos em v1:

- Iniciantes A1 que precisam de curriculo guiado antes de input real.
- Usuarios mobile-only.
- Usuarios casuais de Duolingo que nao sentem dor de card creation.
- Escolas, empresas e compradores com necessidade de admin/reporting.
- Alunos que querem pronuncia/confianca oral como dor primaria.
- Power users que ja tem um fluxo Migaku/Anki perfeito.

Se os resultados mostrarem ativacao, explain-back, retorno D+1/D+7 e diferenciacao claramente
melhores em iniciantes guiados, a narrativa e o onboarding devem mudar para esse segmento antes do
launch publico.

Consequencias de produto:

- PT-BR deve ser a lingua primaria da interface.
- O primeiro valor precisa acontecer em ate 5 minutos; o primeiro loop completo deve mirar menos
  de 2 minutos.
- Provedor de IA nao pode ser requisito para a primeira sessao.
- Termos como `deck`, `provider`, `APKG` e `curation` devem ficar fora do caminho principal,
  mesmo para o publico Anki; eles podem aparecer so depois do loop principal ser compreendido.

## Decisao Central De Identidade

A tensao original era real: PhraseLoop parecia ao mesmo tempo app de consumo e ferramenta de
power-user. O valor forte estava atras de configuracao de IA, Ollama, chaves de API e exportacao
para Anki, enquanto a promessa de UX apontava para um iniciante.

A decisao de v1:

1. O produto principal e um tutor local-first para PT -> EN.
2. O caminho iniciante deve funcionar sem setup: conteudo bundled, licoes guiadas e estudo local.
3. Ferramentas avancadas continuam existindo, mas como profundidade, nao como porta de entrada.
4. Exportacao Anki, TTS, Speak, Plan e provedores externos sao secundarios ao Study interno e
   so aparecem como profundidade depois do primeiro loop.

## Modelo De Negocio

Status: `hipotese` (a validar em sessoes de usuario; nao construir billing em v1).

A hipotese a validar e camada gratuita local + uma unica dor paga inicial que o gratuito nao
consegue replicar trivialmente:

- **Gratuito (local-first):** fala local (Kokoro/Whisper), licoes bundled, SRS local e geracao
  com chave propria (BYO-key). E o caminho de ativacao e o coracao do habito.
- **Pago candidato:** escolher uma dor antes de billing: geracao em nuvem gerenciada de alta
  qualidade sem chave, review-anywhere com sync entre dispositivos, **ou** pacotes de conteudo
  graduado e curado.

Principio: cada funcionalidade deve poder ser rotulada como gratuita ou paga de proposito, mas o
launch nao deve vender um bundle de possibilidades. A primeira oferta paga precisa ser uma dor
facil de repetir em uma frase e que o caminho gratuito/BYO-key genuinamente nao faz.

Validacao: perguntas de disposicao a pagar e "pelo que voce pagaria" entram nas sessoes moderadas.
So transformar billing em roadmap depois que um candidato pago aparecer como substituicao concreta
em entrevistas.

Perguntas obrigatorias de monetizacao:

1. "O que voce ja paga hoje para aprender ingles?"
2. "Qual destes voce pagaria R$19-39/mes para remover?"
3. Opcoes: geracao melhor sem setup local, review no celular com sync, conteudo graduado curado,
   ou nenhum/so usaria gratis.

Regra de corte: se pelo menos 3/10 usuarios do ICP nao escolherem a mesma dor paga com linguagem
concreta, billing continua fora do roadmap.

## Diferenciais

| Diferencial | Por que importa |
| --- | --- |
| Local-first por padrao | Dados de estudo ficam no dispositivo; nuvem so quando o usuario escolhe. |
| Audio nativo por frase | Cards usam clipes recortados da fonte real quando ha timestamp. |
| Fontes como verdade | `ErrorEvent` e `PhraseCandidate` persistem, nao so cards derivados. |
| Erros viram treino | Correct e Speak alimentam o mesmo pipeline de cards, SRS e fraquezas. |
| Geracao plugavel | Ollama, OpenRouter, Claude e OpenAI usam o mesmo contrato de pipeline. |
| Ciclo adaptativo | Revisao, scaffold, cooldown e dificuldade sao tratados como ciclo de aprendizagem. |

## Posicionamento Competitivo

O motivo para trocar ou adicionar PhraseLoop nao e "mais um app de flashcards". O motivo e reduzir
drasticamente o caminho de **fonte real -> frase salva -> revisao com audio -> erro corrigido vira
treino**.

Promessa mensuravel: PhraseLoop so ganha se o learner sair de um clip/artigo real para um card com
audio nativo revisado em menos de 2 minutos, com menos friccao que Anki/Migaku/LingQ.

| Competidor | Onde ganha | Onde PhraseLoop precisa ganhar |
| --- | --- | --- |
| Anki | Gratuito, maduro, cross-platform, sync e decks enormes. | Menos trabalho manual para criar cards com audio da fonte e erros proprios. |
| LingQ | Conteudo importado, contexto e SRS. | Primeiro loop desktop local-first mais direto para frase + audio + erro pessoal. |
| Migaku | Captura de cards no navegador/video. | Fluxo PT-BR desktop com revisao interna e erros virando treino. |
| FluentU | Video autentico polido e conteudo curado. | Material escolhido pelo usuario e dados locais. |
| Speak/ELSA | Fala, confianca e feedback de pronuncia. | Revisao de longo prazo a partir de fontes e erros reais. |
| Chatbots | Conversa flexivel e baixo atrito. | Memoria local de revisoes, clipes nativos e cards derivados automaticamente. |

Nao estamos tentando vencer o Anki como engine de repeticao. Estamos tentando vencer o passo antes
do Anki: encontrar, extrair, limpar, adicionar audio, revisar e reutilizar os erros.

Se usuarios observados nao disserem, sem coaching, que usariam PhraseLoop no lugar do fluxo atual de
criar material de revisao pelos proximos 7 dias, a diferenciacao ainda nao esta pronta para launch.

## Estado Atual

PhraseLoop esta em fase de acabamento de v1, nao de greenfield.

Ja existe:

- Pipeline de cards: minerar, gerar, criticar, deduplicar e aterrar em fontes reais.
- Discover com YouTube, artigo e PDF.
- Clipes nativos por frase quando ha audio/timestamp.
- Study com FSRS, estatisticas, fraquezas, reforco e geracao direcionada.
- Correct para transformar erros de escrita/fala em cards.
- Speak/Converse com conversa e revisao ao fim da sessao.
- Plano adaptativo de 90 dias e Home "Hoje".
- Exportacao `.apkg`, CSV, texto e AnkiConnect.
- Demo/local lessons para primeira experiencia sem provedor.
- Infra de ciclo: telemetria, scaffold, sessao leve, cooldown, cycle picker e band gate.

O trabalho restante e menos "construir motor" e mais "foco, ativacao, confianca e distribuicao".

## Arquitetura Resumida

```text
UI features/* -> app/api/* BFF -> server/runtime -> speech/native/LLM
      |
      v
IndexedDB local-first:
cards, srs, reviews, phraseCandidates, errorEvents,
conversations, activityLog, learningPlan, effortHistory
```

Principios:

- `app/api/*` mantem URLs estaveis e preocupacoes HTTP.
- Dominio vive em `features/*`, `lib/*` e `server/*`.
- Dados de aprendizagem ficam em IndexedDB.
- Cards sao derivacao; fontes e historico de erros sao os ativos.

Detalhes completos ficam em [docs/README.md](README.md).

## Prioridade Ativa

| Prioridade | Decisao | Escopo |
| --- | --- | --- |
| 1 | Evidencia manda no roadmap | TTFR do primeiro loop, explain-back, diferenciacao espontanea e D+1/D+7 decidem o proximo ciclo. |
| 2 | Uma espinha visivel | Ouvir/trazer ingles -> salvar frases -> Study -> Correct -> treino do erro. |
| 3 | Diferenciais no primeiro uso | Criacao sem friccao e erro pessoal virando drill precisam aparecer sem explicacao. |
| 4 | Primeiro cliente escolhido | Launch para autodidata/Anki que traz fontes reais; dados de uso podem sobrescrever se iniciantes vencerem claramente. |
| 5 | Monetizacao por uma dor | Escolher entre nuvem gerenciada, review-anywhere sync ou conteudo graduado curado. |
| 6 | Congelar adaptive research | Manter o que shipped; nao abrir novo trilho adaptativo antes das prioridades 1-5. |
| 7 | Aprofundar tutor depois | Naturalidade, pronuncia, discurso longo e reforco avancado depois do habito. |

## Roadmap Imediato

PhraseLoop nao lanca amplamente ate 10 usuarios do ICP completarem um primeiro loop guiado,
entenderem o valor sem jargao e mostrarem retorno inicial. O primeiro loop precisa provar o wedge:
ingles real e erros do usuario viram cards de revisao com audio nativo. Todo o resto fica escondido
ou congelado.

| Prioridade | Task | Why |
| --- | --- | --- |
| P0 | Reescrever Home/onboarding em torno do loop real | Clareza instantanea do produto |
| P0 | Construir um primeiro loop guiado com audio bundled curado | Prova valor em menos de 2 minutos |
| P0 | Adicionar metricas de ativacao e dropoff | Torna o primeiro loop mensuravel |
| P0 | Esconder termos avancados de provider/deck/model/export | Reduz friccao antes da ativacao |
| P1 | Mostrar own-source como proximo passo depois do loop | Mostra a magia real sem arriscar ativacao |
| P1 | Capturar paid pain e replacement workflow | Valida monetizacao e troca de fluxo |
| P2 | Polir backup/restore | Confianca local-first |
| P2 | Polir falhas de import/YouTube | Evita frustracao quando o usuario traz fonte propria |

Fora do escopo do proximo ciclo:

- Speak mode.
- Planos de 90 dias.
- Configuracao avancada de provedores.
- APKG/export como fluxo primario.
- Suporte amplo a idiomas.
- Novo trilho de adaptive difficulty.
- Gerenciamento complexo de decks.
- Billing antes de uma dor paga unica aparecer em validacao.
- Features para escolas/empresas.
- App mobile completo.
- Social/growth mechanics.
- Framework geral de notificacoes.

## Plano De Validacao

A fase ativa valida o primeiro loop guiado e a menor evidencia necessaria para escolher o
proximo ciclo. O escopo observado e: licao inicial, Discover -> Study -> Correct, metricas de
ativacao/drop-off, PT-BR e acessibilidade, persistencia/restore e confiabilidade.

Decisoes devem usar sessoes observadas, entrevistas, waitlist e eventos locais:

- Se conclusao sem ajuda ou tempo ate valor falhar, corrigir primeiro o passo bloqueador.
- Se o usuario nao conseguir explicar o produto, revisar historia e termos com a linguagem dele.
- Se feedback/retry falhar, melhorar a correcao sem exigir provedor no primeiro uso.
- Se D+1/D+7 falhar, testar o retorno e a passagem para Review antes de ampliar o tutor.
- Se diferenciacao ou substituicao do fluxo atual falhar, rever o wedge antes de billing.

Smoke tests, retencao prevista pelo SRS e feedback amigavel nao contam como retencao observada.
Em auditorias, usar **“No systemic dishonesty found”**, nao a afirmacao absoluta “No dishonesty
found”: houve um pequeno edge case de contagem no pause manual do Discover, hoje coberto por
regressao.

## Curriculo De 100 Licoes

O bundle atual contem **100 licoes e 804 frases** em `src/features/learn/lessons.json`. O foco
editorial continua em A2-B1, mas existe uma trilha completa de A1 a C2. O numero de licoes nao e
evidencia de aprendizagem; uma licao so esta pronta para release depois de revisao de ingles e
PT-BR, audio com proveniencia, QA tecnico e piloto com learners.

| Level | Current | Target | Add | Final share |
| --- | ---: | ---: | ---: | ---: |
| A1 | 15 | 15 | 0 | 15% |
| A2 | 22 | 22 | 0 | 22% |
| B1 | 25 | 25 | 0 | 25% |
| B2 | 18 | 18 | 0 | 18% |
| C1 | 12 | 12 | 0 | 12% |
| C2 | 8 | 8 | 0 | 8% |

### Gates editoriais

1. Conteudo: objetivo comunicativo, contexto real, frases uteis, dialogo, compreensao,
   producao, feedback, retry e review conectados.
2. Audio: texto e clip correspondem, entrega natural adequada ao nivel, diversidade de vozes e
   proveniencia/licenca registrada. Kokoro e fallback sintetico, nao audio nativo.
3. Pedagogia: naturalidade, traducao PT-BR, carga CEFR e utilidade revisadas; nao tratar a falta
   de compreensao palavra por palavra como fracasso.
4. Tecnico: IDs unicos, clips decodificaveis, perguntas nao ambiguas, traducoes presentes e
   testes/typecheck/lint/build aprovados.
5. Evidencia: piloto mede conclusao, compreensao, retry, frases salvas e retorno D+1/D+7.

### Backlog original incorporado pelo validador

As 64 adicoes abaixo ja existem no bundle. A tabela permanece porque
`scripts/validate-lesson-content.mjs` usa os IDs para validar a cobertura e os campos expandidos.

| Wave | Proposed id | Lesson focus |
| --- | --- | --- |
| 2 | `a1-classroom` | Classroom objects and simple instructions |
| 2 | `a1-time-dates` | Clock time, days, dates, and schedules |
| 2 | `a1-likes` | Likes, dislikes, and simple reasons |
| 2 | `a1-abilities` | What I can and cannot do |
| 3 | `a1-errands` | Simple errands and everyday requests |
| 3 | `a1-feelings` | Feelings, preferences, and immediate needs |
| 1 | `a2-cooking` | Ingredients, quantities, and cooking instructions |
| 1 | `a2-hobbies` | Free-time activities and frequency |
| 1 | `a2-hotel` | Checking in, room needs, and simple complaints |
| 1 | `a2-airport` | Check-in, security, gates, and delays |
| 1 | `a2-appointments` | Booking and changing appointments |
| 1 | `a2-clarification` | Asking someone to repeat, slow down, or explain |
| 2 | `a2-responsibilities` | Chores, responsibilities, and routine obligations |
| 2 | `a2-technology` | Devices, messages, passwords, and basic problems |
| 2 | `a2-comparisons` | Comparing people, places, and products |
| 2 | `a2-childhood` | Childhood routines and simple memories |
| 2 | `a2-obligations` | Rules with have to, must, and can |
| 3 | `a2-home-problems` | Repairs and common problems at home |
| 3 | `a2-celebrations` | Invitations, birthdays, and celebrations |
| 3 | `a2-social-plans` | Hosting, joining, confirming, and declining social events |
| 1 | `b1-job-interviews` | Experience, strengths, and interview follow-ups |
| 1 | `b1-work-meetings` | Updates, questions, and action items |
| 1 | `b1-email-messages` | Clear professional email and chat tone |
| 1 | `b1-travel-problems` | Missed connections, lost items, and alternatives |
| 1 | `b1-personal-finance` | Budgets, bills, saving, and everyday money decisions |
| 1 | `b1-storytelling` | Sequencing and adding detail to personal stories |
| 1 | `b1-recommendations` | Reviews, recommendations, and supporting reasons |
| 1 | `b1-apologies` | Apologizing, taking responsibility, and repairing a situation |
| 2 | `b1-reasons-examples` | Explaining a point with reasons and examples |
| 2 | `b1-news-media` | Summarizing news and distinguishing fact from opinion |
| 2 | `b1-health-fitness` | Exercise, wellbeing, and sustainable routines |
| 2 | `b1-habits-change` | Describing change, setbacks, and progress |
| 2 | `b1-processes` | Explaining how a familiar process works |
| 2 | `b1-goals-progress` | Setting goals and reflecting on progress |
| 3 | `b1-cultural-differences` | Comparing customs without overgeneralizing |
| 3 | `b1-community-services` | Public services, local issues, and asking for support |
| 3 | `b1-relationships-boundaries` | Expectations, boundaries, and respectful disagreement |
| 2 | `b2-cause-effect` | Explaining causes, consequences, and contributing factors |
| 2 | `b2-persuasion` | Persuading without overstating a claim |
| 2 | `b2-project-management` | Scope, deadlines, dependencies, and risks |
| 2 | `b2-feedback-leadership` | Giving balanced feedback and setting expectations |
| 2 | `b2-data-interpretation` | Interpreting charts, changes, and uncertainty |
| 3 | `b2-ethical-dilemmas` | Weighing principles and practical consequences |
| 3 | `b2-remote-work` | Collaboration, autonomy, and communication trade-offs |
| 3 | `b2-media-bias` | Framing, evidence selection, and source reliability |
| 3 | `b2-uncertainty` | Speculation, probability, and calibrated confidence |
| 4 | `b2-proposals` | Presenting and defending a structured proposal |
| 4 | `b2-professional-disagreement` | Disagreeing clearly while preserving cooperation |
| 4 | `b2-root-causes` | Diagnosing problems beyond immediate symptoms |
| 4 | `b2-competing-views` | Summarizing and comparing competing positions |
| 3 | `c1-diplomatic-disagreement` | Challenging assumptions with diplomatic precision |
| 3 | `c1-presentations-q-and-a` | Handling difficult questions after a presentation |
| 3 | `c1-stakeholders` | Aligning stakeholders with conflicting priorities |
| 4 | `c1-crisis-communication` | Communicating uncertainty and action under pressure |
| 4 | `c1-policy-analysis` | Evaluating policy aims, mechanisms, and side effects |
| 4 | `c1-research-discussion` | Discussing evidence, limitations, and implications |
| 4 | `c1-mentoring` | Coaching, reframing, and asking productive questions |
| 4 | `c1-strategic-priorities` | Distinguishing urgent work from strategically important work |
| 4 | `c1-nuanced-narratives` | Telling complex stories with shifts in stance and perspective |
| 4 | `c2-implicit-assumptions` | Exposing assumptions and expressing epistemic caution |
| 4 | `c2-analogy-metaphor` | Using and critiquing analogy, metaphor, and framing |
| 4 | `c2-high-stakes-negotiation` | Strategic ambiguity and precise concessions |
| 4 | `c2-editorial-argument` | Building a concise, rhetorically controlled editorial argument |
| 4 | `c2-debate-synthesis` | Synthesizing dense debate without flattening disagreement |

Status: todos os quatro waves foram escritos e passam o QA estrutural, mas continuam pendentes
de proveniencia de audio, revisao editorial e pilotos. Expansao alem de 100 licoes so entra no
roadmap se a validacao mostrar demanda por mais curriculo bundled.

## Tracker De Produto

| Area | Status | Nota |
| --- | --- | --- |
| Identidade de produto | Done | README e metadata ja apontam para tutor de ingles local-first. |
| Foco da primeira tela | Done | Home "Hoje" e Discover mais direto. |
| Visibilidade de Study | Done | Study fica principal; Speak permanece profundidade depois do loop. |
| Onboarding | Done | Pergunta lingua nativa, nivel e objetivo; ingles e default honesto. |
| Promessa multi-idioma | Partial | V1 esta English-first, mas ainda ha copy/codigo a auditar. |
| Seguranca dos dados locais | Partial | Backup JSON, restore com dry-run e testes (round-trip + migracao de schema) existem; falta rodar restore com usuario real. |
| Transparencia de dados | Done | Settings mostra onde os dados ficam (pasta real via GET /api/data) e apaga todos os dados locais (IndexedDB + localStorage + arquivos pessoais em disco, modelos preservados). |
| Performance em escala | Partial | Query helpers shipped (2026-07-08): due count via indice `due` (`countDueCards`), reviews recentes via indice `reviewedAt` (`getReviewsSince`), lookups em lote (`getMany`) eliminam N+1 em due cards/save/reinforcement e a orientacao de cards carrega so as fontes referenciadas. Faltam summaries denormalizados. |
| Complexidade de Converse | Planned | Extrair hooks de sessao, recorder e review. |
| Erros de API | Done | Taxonomia tipada em src/server/http/providerFailure.ts (400/422/429/499/502/504 com code estavel); toda falha visivel em PT-BR, sem erro cru; testes forcam timeout, abort e input invalido. |
| Copy de confianca | Done | README nao promete OS secure storage indevidamente. |

Proximo passe recomendado:

1. Validar restore com usuarios reais antes de dados de longo prazo.
2. Summaries denormalizados (query helpers de due count, reviews recentes e batch lookup
   shipped 2026-07-08 em `src/lib/store/db.ts` / `repository.ts`).
3. Split de `ConverseTab` em hooks menores.

## Revisao UX De Primeira Experiencia

Primeira sessao v1, uma unica trilha:

1. Usuario ouve um clip curto de ingles real curado.
2. App destaca 2-3 frases uteis.
3. Usuario salva uma frase.
4. Usuario revisa essa frase imediatamente com o audio bundled.
5. Usuario escreve uma frase usando a expressao.
6. App corrige a frase.
7. Correcao vira card de revisao de amanha.
8. Tela final confirma: "Voce criou 2 cards de revisao: um de ingles real, um do seu proprio erro."

So depois dessa conclusao aparece o proximo passo: "Agora teste com seu proprio video do YouTube
ou artigo." Import proprio nunca deve ser a primeira prova do produto, porque pode falhar, demorar
ou exigir conceitos antes da ativacao.

| Item | Impacto | Status | Decisao |
| --- | --- | --- | --- |
| Home "Hoje" | High | Done | Primeira tela com uma proxima acao clara. |
| Discover sem bloquear por IA | High | Done | Import/transcricao nao dependem de provedor. |
| Try demo | High | Done | Home abre a licao bundled recomendada; Discover nao deve ter um segundo demo concorrente. |
| Reduzir calendario no inicio | Med | Done | Dashboard so aparece com progresso real. |
| Linguagem de aprendiz | Med | Planned | Trocar jargoes por "frases para praticar", "salvar para estudar" etc. |
| Study local > Anki | Med | Done | CTA principal salva e estuda; Anki fica avancado e escondido ate o loop ser entendido. |
| PT-BR completo | Med | Done | Auditoria da primeira sessao concluida (2026-07-13): Correct tab, previews, a11y, metadata e loading screen do Electron cobertos. Ferramentas avancadas (tier 3, atras de Settings) ficam em ingles por decisao. |
| Settings de IA guiado | Med | Partial | Provedores estao em Advanced AI; falta copy "Local no computador" vs "Nuvem mais facil". |
| Coaching contextual | Low | Planned | Explicar o proximo passo no momento certo. |
| Tools fora da nav primaria | Low | Done | Ferramentas em Settings/Advanced. |
| Ativacao sem setup | High | Done | Licoes e audio bundled landed; o loop guiado completa offline (salvar -> escrever frase -> correcao local -> revisar) sem provedor. Audio sintetico bundled e aceitavel; gravacoes licenciadas sao melhoria opcional. |

Checklist de launch antes de publico:

1. Build assinado/notarizado sem workaround de Gatekeeper para participantes reais.
   (Codigo pronto: electron/build-app.sh assina e notariza .app e .dmg quando
   APPLE_DEVELOPER_ID + credenciais do notarytool estao no env. Falta apenas
   inscricao no Apple Developer Program e exportar as credenciais.)
2. Audio bundled validado com usuarios; sem clipe ausente, corrompido ou ininteligivel.
3. [x] Auditoria PT-BR da primeira sessao e termos avancados fora do caminho principal.
4. Restore validado em sessao real com dados de longo prazo.
5. Taxonomia HTTP para falhas de provedor, timeout/abort e input invalido.
6. Fallback claro para falha de YouTube/import sem bloquear licao bundled e Study.
7. Usuario consegue deletar dados locais.
8. Usuario entende onde os dados ficam armazenados.

Historico de ativacao shipped:

- Epic A "Try demo": botao, clipes bundled, persistencia idempotente, reset/copy PT-BR.
- Epic B "Hoje": landing default, uma proxima acao, progresso leve, estados vazios.

## Critica De Produto

### Iniciantes

- O muro de setup ainda pode matar a ativacao depois do demo se nao houver trilha sem provedor.
- Input nativo arbitrario e dificil demais para A1; iniciante precisa input graduado.
- Pronuncia e uma lacuna grande: Whisper corrige texto, nao avalia fonetica de verdade.
- Cold start sem cards e ruim; o usuario quer "licao guiada agora".
- Muita superficie gera sobrecarga: Home, Discover, Study, Correct, Speak, Plan, Tools.
- Converse precisa mais scaffolding em L1 para A1.

### Avancados

- C1 precisa naturalidade, registro, idiomaticidade e colocacao, nao so erro gramatical. A
  proposta experimental esta resumida em [Fase C1 experimental](#fase-c1-experimental).
- FSRS/flashcards perdem valor se o conteudo for trivial.
- Conversa precisa ser menos enlatada e mais aberta.
- Falta feedback de discurso longo.
- Curadoria precisa explicar nuance, sinonimos e registro.

### Transversal

- Progresso ainda mede muito esforco, pouco resultado de proficiencia.
- Custo de API precisa ser mais visivel.
- Motivacao/habito ainda e magro. Parcialmente enderecado (2026-07-09) dentro do freeze:
  o return moment do Hoje agora dispara em todo dia de retorno (D+1 a D+7) com contagem
  honesta de cards vindos de erros reais (`src/features/home/returnMoment.ts`), e o fim de
  sessao mostra o preview "Amanha: N frases te esperam" fechando o loop. Loop de habito
  completo continua P3.
- Anki e Study interno competem na narrativa; Study deve ser o centro.

Recomendacao critica:

1. P0: identidade + ativacao iniciante sem setup.
2. P1: avaliacao de pronuncia real.
3. P2: feedback de naturalidade para intermediario/avancado.
4. P3: progresso por resultado e loop de habito.

## Fase C1 Experimental

O slice C1 existe como superficie deliberadamente experimental em Settings; nao faz parte da
navegacao principal nem deve ser tratado como validado. O problema a testar e se learners acima
de B1/B2 precisam menos de correcao gramatical e mais de naturalidade, registro, idiomaticidade e
colocacao.

O MVP fica limitado a:

1. Diagnostico com os `errorTypes` existentes e uma amostra curta de escrita.
2. Evidencia ao lado de cada gap; nunca mostrar um rotulo “Weak” sem frase/exemplo real.
3. Um unico dominio escolhido a partir da necessidade observada.
4. Um loop write -> feedback -> speak para verificar transferencia.

Continuar apenas se learners confiarem nos gaps, completarem o loop e voltarem a ele sem prompt.
Se aceitarem o relatorio mas nao mudarem a pratica, cortar a ideia. Biblioteca curada de conteudo
nativo, builder multidominio, dashboards de skill/fluencia e enforcement automatico de proporcao
ficam adiados.

## Pesquisa Aplicada

A sintese da pesquisa nao e "tirar o aluno da zona de conforto sempre". A formulacao mais
util e: governar ciclos adaptativos entre desafio, consolidacao, recuperacao e retorno.

Principios:

- **Flow:** desafio e habilidade precisam ficar em equilibrio.
- **ZDP:** tarefa deve ficar um pouco alem do que o aluno faz sozinho, com suporte temporario.
- **Challenge Point:** dificuldade funcional depende do usuario e do momento.
- **Dificuldades desejaveis:** treino mais dificil pode melhorar retencao, mas nao toda
  dificuldade e desejavel.
- **Performance != aprendizagem:** acertar agora nao prova retencao futura.
- **Spacing/retrieval:** revisao ativa e retorno no timing certo sao a espinha.
- **Interleaving seletivo:** pode ajudar categorias confundiveis, mas pode prejudicar listas de
  palavras se aplicado indiscriminadamente.

Traducao para PhraseLoop:

- Manter FSRS e active recall como centro.
- Capturar latencia, hint/scaffold e fadiga para detectar sobrecarga.
- Oferecer scaffold opt-in e removivel.
- Ter sessao leve/cooldown para dias ruins.
- Separar resultado imediato de retencao prevista.
- Usar dificuldade adaptativa com gate, nao como nova promessa ampla.
- Evitar XP, ligas, notificacoes agressivas e A/B infra.

## Ciclo Adaptativo Shipped

| Recomendacao | Status | Evidencia |
| --- | --- | --- |
| Telemetria de review | Shipped | `ReviewRecord` aceita latencia, hint e scaffold. |
| End screen honesto | Shipped | `SessionSummary` separa accuracy agora vs estabilidade prevista. |
| Scaffold em Study | Shipped | Hint, audio 0.75x e fallback "listen & repeat". |
| Sessao leve/cooldown | Shipped | `sessionMode.ts` e prompt de saturacao. |
| Estado por habilidade | Shipped | `skillState.ts` deriva proficiencia, fadiga e due por skill. |
| Home/cycle picker | Shipped | `cyclePlanner.ts` oferece challenge/review/light com default. |
| Difficulty band | Shipped gated | `band.ts`/`bandQueue.ts` so reordena quando o gate indica `adopt`. |

Ainda pendente: validacao D+1/D+7 para confirmar se scaffold e band gate melhoram retencao real.

## Metricas

Sinais minimos para launch amplo:

- Pelo menos 6/10 completam o primeiro loop sem ajuda.
- Mediana do tempo ate o primeiro loop completo abaixo de 2 minutos.
- Pelo menos 7/10 explicam PhraseLoop como "transforma ingles real e meus erros em cards de
  revisao" sem prompt.
- Pelo menos 40% retornam D+1 e 25% retornam D+7.
- Pelo menos 3/10 nomeiam audio nativo, erros virando drills ou card creation com menos friccao
  espontaneamente.
- Pelo menos 3/10 nomeiam a mesma dor paga concreta; se `none` vence ou empata, billing continua
  congelado.
- Pelo menos 3/10 dizem que usariam PhraseLoop no lugar do fluxo atual de Anki/card-making pelos
  proximos 7 dias.

Eventos minimos de ativacao:

```ts
first_run_started
clip_played
phrase_saved
review_started
review_completed
mistake_submitted
correction_saved
first_loop_completed
own_source_started
own_source_completed
day_1_returned
day_7_returned
```

Metricas derivadas:

```ts
activation = first_loop_completed
ttfr = first_loop_completed.ts - first_run_started.ts
dropoff_step =
  | "clip"
  | "save_phrase"
  | "review"
  | "mistake"
  | "correction"
  | "own_source"
```

Metricas secundarias continuam validas depois do gate: recall previsto vs recall real, uso de dica,
latencia, abandono depois de erro, percentual de UI em PT-BR, incidentes de perda de dados e
retencao D+30.

## Riscos

| Risco | Severidade | Mitigacao |
| --- | --- | --- |
| Dados locais sem restore | High | Backup restore + testes de migracao antes de usuarios reais. |
| Plataforma estreita | High | Comunicar macOS 14+ Apple Silicon e degradar bem. |
| Muro de IA | High | Demo/lessons robustos e provedor como avancado. |
| Divida i18n | Medium-High | PT-BR na Definition of Done. |
| Friccao de distribuicao | Medium | Notarizacao antes de lancamento publico. |
| Performance IndexedDB | Medium | Query helpers e summaries. |
| Variabilidade de provedor | Medium | Taxonomia de erro e modelos recomendados. |
| Drift de identidade | Medium | Manter English-first e PT -> EN para v1. |
| Diferenciacao fraca | High | Validacao precisa capturar substituicao do fluxo atual e diferenciador espontaneo. |

## Metodo De Trabalho

Kanban leve, doc-driven, WIP 1-2.

Definition of Done:

1. Teste Vitest para logica nova quando aplicavel.
2. Strings PT-BR para copy user-facing.
3. Atualizar este documento se a prioridade/status mudou.
4. Evitar nova superficie se a mesma jornada puder ser resolvida com Home -> Discover -> Study -> Correct.

## Decisao Final

PhraseLoop nao precisa provar que o motor funciona; precisa terminar a ponte entre esse motor e
um autodidata real que ja tenta transformar ingles real em pratica. A sequencia correta e:

1. Foco e ativacao sem setup.
2. Linguagem PT-BR simples.
3. Confianca em dados locais.
4. Reengajamento calmo.
5. Tutor mais profundo so depois que o habito existir.
