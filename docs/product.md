# PhraseLoop - Produto, Pesquisa e Roadmap

Este e o documento canonico de produto. Ele unifica o que antes estava espalhado por
`PROPOSAL.md`, `IMPROVEMENTS.md`, `CRITICA-PRODUTO.md`,
`deep-research-report.md`, `docs/product-improvement-plan.md`,
`docs/product-strategy.md` e `docs/cycle-implementation-plan.md`.

Use:

- [README.md](../README.md) para setup, execucao e visao publica do app.
- [docs/README.md](README.md) para arquitetura, historico tecnico e features shipped.
- [docs/design-system.md](design-system.md) para regras visuais.
- Este arquivo para direcao de produto, pesquisa aplicada, prioridades e backlog.

## Produto Em Uma Frase

PhraseLoop ajuda brasileiros aprendendo ingles a transformar ingles real em frases com audio
nativo para revisao, producao e reforco diario, com uma experiencia desktop local-first.

Essa frase e a fonte de verdade para README, onboarding, landing copy, release notes e roadmap.

## Tese

Ferramentas de idioma tendem a otimizar consumo passivo ou memorizacao isolada. PhraseLoop
aposta em um ciclo fechado:

```text
capturar -> estudar -> produzir -> reforcar
```

O usuario traz material real ou produz linguagem propria. O app transforma isso em frases
estudaveis, agenda revisoes, detecta fraquezas e gera reforco a partir dos erros reais.

## Usuario-Alvo

O recorte de v1 e deliberadamente estreito:

- Brasileiro falante de portugues aprendendo ingles.
- Nivel A1/A2 no inicio, com caminho para B1+.
- Desktop primeiro, macOS Apple Silicon primeiro.
- Quer aprender sem configurar infraestrutura tecnica antes da primeira recompensa.

Consequencias de produto:

- PT-BR deve ser a lingua primaria da interface.
- O primeiro valor precisa acontecer em ate 5 minutos.
- Provedor de IA nao pode ser requisito para a primeira sessao.
- Termos como `deck`, `provider`, `APKG` e `curation` devem ficar fora do caminho principal.

## Decisao Central De Identidade

A tensao original era real: PhraseLoop parecia ao mesmo tempo app de consumo e ferramenta de
power-user. O valor forte estava atras de configuracao de IA, Ollama, chaves de API e exportacao
para Anki, enquanto a promessa de UX apontava para um iniciante.

A decisao de v1:

1. O produto principal e um tutor local-first para PT -> EN.
2. O caminho iniciante deve funcionar sem setup: conteudo bundled, licoes guiadas e estudo local.
3. Ferramentas avancadas continuam existindo, mas como profundidade, nao como porta de entrada.
4. Exportacao Anki e provedores externos sao secundarios ao Study interno.

## Diferenciais

| Diferencial | Por que importa |
| --- | --- |
| Local-first por padrao | Dados de estudo ficam no dispositivo; nuvem so quando o usuario escolhe. |
| Audio nativo por frase | Cards usam clipes recortados da fonte real quando ha timestamp. |
| Fontes como verdade | `ErrorEvent` e `PhraseCandidate` persistem, nao so cards derivados. |
| Erros viram treino | Correct e Speak alimentam o mesmo pipeline de cards, SRS e fraquezas. |
| Geracao plugavel | Ollama, OpenRouter, Claude e OpenAI usam o mesmo contrato de pipeline. |
| Ciclo adaptativo | Revisao, scaffold, cooldown e dificuldade sao tratados como ciclo de aprendizagem. |

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
| 1 | Fixar identidade | PT -> EN, brasileiro iniciante, desktop-first. |
| 2 | Uau em 5 minutos | URL ou demo bundled -> frases com audio -> primeira revisao, sem chave nem Ollama. |
| 3 | Reengajamento calmo | Um unico pull opcional: preferir contador discreto de revisoes/due no desktop. |
| 4 | IA mais simples | Espinha visivel: Hoje -> Discover -> Study -> Correct; Tools/Speech secundarios. |
| 5 | Review-anywhere | Especificar app/web companion para revisar cards fora do desktop. |
| 6 | Congelar adaptive research | Manter o que shipped; nao abrir novo trilho adaptativo antes das prioridades 1-5. |
| 7 | Aprofundar tutor depois | Naturalidade, pronuncia, discurso longo e reforco avancado depois do habito. |

## Roadmap Imediato

1. **Identity pass.** Alinhar README, onboarding, settings e landing ao recorte PT -> EN.
2. **First-run wow.** Fazer o caminho default ser zero-config: licao bundled ou URL, cards com
   audio, salvar no Study e primeira revisao.
3. **IA pass.** Deixar Discover -> Study -> Correct como a espinha; mover ferramentas avancadas
   para Settings/Advanced.
4. **Reengajamento.** Escolher e construir um pull calmo, preferencialmente menu-bar due count.
5. **Review-anywhere spec.** Definir payload, sync, conflito, auth/storage e offline behavior.

Fora do escopo do proximo ciclo:

- Novo trilho de adaptive difficulty.
- Expansao ampla de task types.
- Social/growth mechanics.
- Framework geral de notificacoes.
- Onboarding centrado em provedor.

## Tracker De Produto

| Area | Status | Nota |
| --- | --- | --- |
| Identidade de produto | Done | README e metadata ja apontam para tutor de ingles local-first. |
| Foco da primeira tela | Done | Home "Hoje" e Discover mais direto. |
| Visibilidade de Study | Done | Study e Speak viraram abas principais. |
| Onboarding | Done | Pergunta lingua nativa, nivel e objetivo; ingles e default honesto. |
| Promessa multi-idioma | Partial | V1 esta English-first, mas ainda ha copy/codigo a auditar. |
| Seguranca dos dados locais | Partial | Backup JSON existe; falta restore/import e testes de migracao. |
| Performance em escala | Planned | Falta helper indexado/limitado e summaries denormalizados. |
| Complexidade de Converse | Planned | Extrair hooks de sessao, recorder e review. |
| Erros de API | Partial | Validacao 400/413 existe; falta taxonomia 502/504/abort completa. |
| Copy de confianca | Done | README nao promete OS secure storage indevidamente. |

Proximo passe recomendado:

1. Restore/import de backup com validacao e dry-run.
2. Testes de migracao IndexedDB e compatibilidade de backup.
3. Query helpers para reviews recentes, due counts e summaries.
4. Split de `ConverseTab` em hooks menores.
5. Taxonomia HTTP tipada para falhas de provedor, timeout/abort e input invalido.

## Revisao UX De Primeira Experiencia

| Item | Impacto | Status | Decisao |
| --- | --- | --- | --- |
| Home "Hoje" | High | Done | Primeira tela com uma proxima acao clara. |
| Discover sem bloquear por IA | High | Done | Import/transcricao nao dependem de provedor. |
| Try demo | High | Done | Exemplo bundled entra no mesmo fluxo de review/save/study. |
| Reduzir calendario no inicio | Med | Done | Dashboard so aparece com progresso real. |
| Linguagem de aprendiz | Med | Planned | Trocar jargoes por "frases para praticar", "salvar para estudar" etc. |
| Study local > Anki | Med | Done | CTA principal salva e estuda; Anki fica avancado. |
| PT-BR completo | Med | Partial | Infra existe; ainda ha hardcoded English. |
| Settings de IA guiado | Med | Planned | "Local no computador" vs "Nuvem mais facil" com autoteste. |
| Coaching contextual | Low | Planned | Explicar o proximo passo no momento certo. |
| Tools fora da nav primaria | Low | Done | Ferramentas em Settings/Advanced. |
| Ativacao sem setup | High | Partial | Licoes bundled landed; falta substituir WAVs placeholder por Kokoro. |

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

- C1 precisa naturalidade, registro, idiomaticidade e colocacao, nao so erro gramatical.
- FSRS/flashcards perdem valor se o conteudo for trivial.
- Conversa precisa ser menos enlatada e mais aberta.
- Falta feedback de discurso longo.
- Curadoria precisa explicar nuance, sinonimos e registro.

### Transversal

- Progresso ainda mede muito esforco, pouco resultado de proficiencia.
- Custo de API precisa ser mais visivel.
- Motivacao/habito ainda e magro.
- Anki e Study interno competem na narrativa; Study deve ser o centro.

Recomendacao critica:

1. P0: identidade + ativacao iniciante sem setup.
2. P1: avaliacao de pronuncia real.
3. P2: feedback de naturalidade para intermediario/avancado.
4. P3: progresso por resultado e loop de habito.

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

- Time-to-first-card: alvo menor que 5 min, ideal menor que 2 min no demo.
- Loop completion: capturar -> estudar -> produzir -> reforcar.
- Retencao D+1/D+7/D+30 de itens revisados.
- Recall previsto vs recall real.
- Uso de dica, latencia e abandono depois de erro.
- Percentual de UI em PT-BR.
- Incidentes de perda de dados: alvo zero.
- 7-day retention proxy e sobrevivencia de streak sem pressao.

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

## Metodo De Trabalho

Kanban leve, doc-driven, WIP 1-2.

Definition of Done:

1. Teste Vitest para logica nova quando aplicavel.
2. Strings PT-BR para copy user-facing.
3. Atualizar este documento se a prioridade/status mudou.
4. Evitar nova superficie se a mesma jornada puder ser resolvida com Home -> Discover -> Study -> Correct.

## Decisao Final

PhraseLoop nao precisa provar que o motor funciona; precisa terminar a ponte entre esse motor e
um iniciante real. A sequencia correta e:

1. Foco e ativacao sem setup.
2. Linguagem PT-BR simples.
3. Confianca em dados locais.
4. Reengajamento calmo.
5. Tutor mais profundo so depois que o habito existir.
