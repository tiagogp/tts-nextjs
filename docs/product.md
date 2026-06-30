# PhraseLoop - Produto, Pesquisa e Roadmap

Este e o documento canonico de produto. Ele unifica o que antes estava espalhado por
`PROPOSAL.md`, `IMPROVEMENTS.md`, `CRITICA-PRODUTO.md`,
`deep-research-report.md`, `docs/product-improvement-plan.md`,
`docs/product-strategy.md` e `docs/cycle-implementation-plan.md`.

Use:

- [README.md](../README.md) para setup, execucao e visao publica do app.
- [docs/README.md](README.md) para arquitetura, historico tecnico e features shipped.
- [docs/design-system.md](design-system.md) para regras visuais.
- [docs/w5-validation-protocol.md](w5-validation-protocol.md) para o gate de validacao que decide
  identidade, plataforma, monetizacao e escopo antes do launch. O plano sequenciado vive nas secoes
  "Prioridade Ativa", "Roadmap Imediato" e "Riscos" deste arquivo.
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

## Guardrails De Launch

Antes do launch, o roadmap fica subordinado a evidencia do W5. As decisoes de escopo, segmento
inicial e monetizacao devem seguir os sinais de TTFR, explain-back, diferenciacao espontanea e
retorno D+1/D+7.

Decisoes de launch:

1. Rodar o W5 exatamente como escrito antes de reabrir novas superficies de produto.
2. Reduzir a experiencia visivel a um loop: demo ou Discover -> salvar frases -> Study ->
   Correct -> treino a partir do erro.
3. Fazer os dois diferenciais reais aparecerem na primeira sessao: audio nativo de material real
   e erros pessoais virando drills de revisao.
4. Primeiro cliente escolhido para launch: autodidata/usuario de Anki que traz fontes reais,
   entende revisao e sente a dor de transformar material real em pratica.
5. Empacotar monetizacao em uma dor concreta, nao em um pacote generico de possibilidades.

## Usuario-Alvo

O recorte de v1 e deliberadamente estreito:

- Brasileiro falante de portugues aprendendo ingles.
- Nivel A1/A2 no inicio, com caminho para B1+.
- Desktop primeiro, macOS Apple Silicon primeiro.
- Quer aprender sem configurar infraestrutura tecnica antes da primeira recompensa.

O primeiro cliente de launch e **autodidata/Anki**: quem traz fontes reais, entende revisao e
valoriza reduzir o trabalho manual de transformar material em pratica diaria. O iniciante guiado
continua suportado pela licao demo e por licoes bundled, mas nao e a narrativa primaria de launch.

O W5 continua soberano: se os resultados mostrarem ativacao, explain-back, retorno D+1/D+7 e
diferenciacao claramente melhores em iniciantes guiados, a narrativa e o onboarding devem mudar
para esse segmento antes do launch publico.

Consequencias de produto:

- PT-BR deve ser a lingua primaria da interface.
- O primeiro valor precisa acontecer em ate 5 minutos.
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

Validacao: perguntas de disposicao a pagar e "pelo que voce pagaria" entram nas sessoes moderadas
(ver [w5-validation-protocol.md](w5-validation-protocol.md)). So transformar billing em roadmap depois que um candidato
pago aparecer como substituicao concreta em entrevistas.

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
| 1 | W5 manda no roadmap | TTFR, explain-back, diferenciacao espontanea e D+1/D+7 decidem o proximo ciclo. |
| 2 | Uma espinha visivel | Demo ou Discover -> salvar frases -> Study -> Correct -> treino do erro. |
| 3 | Diferenciais no primeiro uso | Audio nativo de material real e erro pessoal virando drill precisam aparecer sem explicacao. |
| 4 | Primeiro cliente escolhido | Launch para autodidata/Anki que traz fontes reais; W5 pode sobrescrever se iniciantes vencerem claramente. |
| 5 | Monetizacao por uma dor | Escolher entre nuvem gerenciada, review-anywhere sync ou conteudo graduado curado. |
| 6 | Congelar adaptive research | Manter o que shipped; nao abrir novo trilho adaptativo antes das prioridades 1-5. |
| 7 | Aprofundar tutor depois | Naturalidade, pronuncia, discurso longo e reforco avancado depois do habito. |

## Roadmap Imediato

1. **W5 como gate.** Rodar o protocolo sem coaching e travar roadmap em TTFR, explain-back,
   diferenciacao espontanea e retorno D+1/D+7.
2. **Loop unico de launch.** Fazer o caminho default ser zero-config: demo ou Discover -> salvar
   frases com audio -> Study -> Correct -> drill a partir de um erro.
3. **Diferenciais visiveis.** Garantir que a primeira sessao mostre audio nativo de material real
   e erro pessoal virando revisao, sem depender de explicacao do moderador.
4. **Segmento escolhido.** Fazer o launch falar com autodidatas/usuarios de Anki que trazem fontes
   reais; mudar apenas se o W5 mostrar vencedor claro em iniciantes guiados.
5. **Oferta paga unica.** Escolher um candidato de monetizacao: nuvem gerenciada, review-anywhere
   sync ou conteudo graduado curado.

Fora do escopo do proximo ciclo:

- Novo trilho de adaptive difficulty.
- Expansao ampla de task types.
- Social/growth mechanics.
- Framework geral de notificacoes.
- Onboarding centrado em provedor.
- Billing antes de uma dor paga unica aparecer em validacao.
- Promover Converse/Plan/Tools, Anki export, TTS ou provedores como caminho principal de launch.

## Tracker De Produto

| Area | Status | Nota |
| --- | --- | --- |
| Identidade de produto | Done | README e metadata ja apontam para tutor de ingles local-first. |
| Foco da primeira tela | Done | Home "Hoje" e Discover mais direto. |
| Visibilidade de Study | Done | Study fica principal; Speak permanece profundidade depois do loop. |
| Onboarding | Done | Pergunta lingua nativa, nivel e objetivo; ingles e default honesto. |
| Promessa multi-idioma | Partial | V1 esta English-first, mas ainda ha copy/codigo a auditar. |
| Seguranca dos dados locais | Partial | Backup JSON, restore com dry-run e testes (round-trip + migracao de schema) existem; falta validar restore com usuarios reais. |
| Performance em escala | Planned | Falta helper indexado/limitado e summaries denormalizados. |
| Complexidade de Converse | Planned | Extrair hooks de sessao, recorder e review. |
| Erros de API | Partial | Validacao 400/413 existe; falta taxonomia 502/504/abort completa. |
| Copy de confianca | Done | README nao promete OS secure storage indevidamente. |

Proximo passe recomendado:

1. Validar restore com usuarios reais antes de dados de longo prazo.
2. Query helpers para reviews recentes, due counts e summaries.
3. Split de `ConverseTab` em hooks menores.
4. Taxonomia HTTP tipada para falhas de provedor, timeout/abort e input invalido.

## Revisao UX De Primeira Experiencia

| Item | Impacto | Status | Decisao |
| --- | --- | --- | --- |
| Home "Hoje" | High | Done | Primeira tela com uma proxima acao clara. |
| Discover sem bloquear por IA | High | Done | Import/transcricao nao dependem de provedor. |
| Try demo | High | Done | Exemplo bundled entra no mesmo fluxo de review/save/study. |
| Reduzir calendario no inicio | Med | Done | Dashboard so aparece com progresso real. |
| Linguagem de aprendiz | Med | Planned | Trocar jargoes por "frases para praticar", "salvar para estudar" etc. |
| Study local > Anki | Med | Done | CTA principal salva e estuda; Anki fica avancado e escondido ate o loop ser entendido. |
| PT-BR completo | Med | Partial | Infra existe; ainda ha hardcoded English. |
| Settings de IA guiado | Med | Partial | Provedores estao em Advanced AI; falta copy "Local no computador" vs "Nuvem mais facil". |
| Coaching contextual | Low | Planned | Explicar o proximo passo no momento certo. |
| Tools fora da nav primaria | Low | Done | Ferramentas em Settings/Advanced. |
| Ativacao sem setup | High | Partial | Licoes bundled landed; primeira tela abre a licao recomendada e mede save/review; falta substituir WAVs placeholder por Kokoro. |

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
