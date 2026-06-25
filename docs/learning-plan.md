# Learning Plan — Structured 90-Day Feature

## O que é

Um plano de aprendizado personalizado gerado a partir do perfil do usuário (`LearningProfile`),
dividido em fases diárias com tarefas concretas que mapeiam para as features existentes do app.
O plano se adapta automaticamente com base no esforço real medido.

---

## Conceito central

```
Meta + Perfil → Plano gerado por LLM → Calendário de dias → Tarefa do dia
                                                                    ↓
                                              Usuário executa (Discover / Study / Converse)
                                                                    ↓
                                              Activity log registra o que foi feito de verdade
                                                                    ↓
                                              Comparação plano vs. realidade → ajuste automático
```

---

## Inputs do usuário (onboarding do plano)

| Campo | Tipo | Exemplo |
|---|---|---|
| `goal` | texto livre | "Conseguir conversar em espanhol em situações do dia a dia" |
| `targetLevel` | enum CEFR | B1 |
| `currentLevel` | já existe em `LearningProfile.level` | A2 |
| `availabilityMinutes` | número | 20 min/dia |
| `planDays` | número | 90 |
| `language` | já existe no perfil | Espanhol |

---

## Estrutura do plano

### Fases (geradas por LLM)

O plano é dividido em fases temáticas. Exemplo para 90 dias / 20 min:

```
Fase 1 (dias 1–30):  Listening & vocabulário de sobrevivência
  → Foco: Discover 3x/semana, Study diário, sem Converse ainda

Fase 2 (dias 31–60): Output básico + correção de erros
  → Foco: Converse 2x/semana, Correct das conversas, cards dos erros

Fase 3 (dias 61–90): Fluência e consolidação
  → Foco: conteúdo mais denso no Discover, Converse sem roteiro
```

### Tarefa do dia (`DailyTask`)

Cada dia tem uma lista de tarefas concretas, cada uma com um `tab` de destino:

```ts
interface DailyTask {
  date: string;               // "2026-06-24"
  phase: number;
  tasks: TaskItem[];
  estimatedMinutes: number;
  completedAt?: number;
}

interface TaskItem {
  id: string;
  type: "discover" | "study" | "converse" | "correct";
  instruction: string;        // ex: "Descubra 1 vídeo curto sobre viagens"
  targetMetric?: {            // o que conta como "feito"
    action: "cards_reviewed" | "video_processed" | "conversation_turns" | "cards_created";
    quantity: number;
  };
  completedAt?: number;
}
```

---

## Activity Log (camada nova necessária)

O plano precisa saber o que o usuário **realmente fez**. Hoje cada feature vive no
seu próprio estado. É necessária uma store `activityLog` no IndexedDB:

```ts
interface ActivityEvent {
  id: string;
  ts: number;
  type:
    | "cards_reviewed"       // Study — n cards graduados
    | "video_processed"      // Discover — transcrição → cards gerada
    | "conversation_turn"    // Converse — turno enviado
    | "correction_generated" // Correct — deck criado
    | "cards_created";       // qualquer fonte → n cards novos
  payload: Record<string, unknown>;  // contagem, cardIds, conversationId, etc.
}
```

Cada feature emite eventos para essa store. O plan engine lê e marca tarefas como feitas.

**Onde emitir:**
- `StudyTab` → após `onGrade` bem-sucedido
- `DiscoverTab` → após export de cards do transcript
- `ConverseTab` → após cada turno enviado
- `CorrectTab` → após geração de deck

---

## Medição de esforço

Além de "feito/não feito", o sistema mede a **intensidade** da sessão:

```ts
interface EffortSnapshot {
  weekOf: string;                   // "2026-W26"
  plannedMinutes: number;           // soma das estimativas do plano nessa semana
  actualMinutes: number;            // derivado do activity log (timestamps)
  adherenceRate: number;            // 0–1
  streak: number;                   // dias consecutivos com alguma atividade
}
```

Derivado automaticamente — sem o usuário ter que registrar nada manualmente.

---

## Adaptação do plano

A cada 7 dias (ou quando o usuário pede), o sistema re-avalia:

```
IF adherenceRate < 0.5 por 2 semanas seguidas:
  → reduz quantidade diária de tarefas
  → notifica: "Parece que 20 min/dia está puxado. Que tal 10 min?"

IF adherenceRate > 0.9 por 2 semanas seguidas:
  → sugere avançar a fase atual
  → oferece aumentar a carga

IF streak == 0 por 3 dias:
  → notifica tarefa de "retomada" (mais leve que o normal)
```

O LLM gera a revisão do plano com base no `EffortSnapshot` + histórico de reviews do FSRS.

---

## Integração com o que já existe

| O que já existe | Como o plano usa |
|---|---|
| `LearningProfile.level` | ponto de partida do plano |
| `LearningProfile.goal` (cards/semana) | vira `availabilityMinutes` aproximado |
| `ReviewRecord` (FSRS) | mede progresso real de vocabulário |
| `conversations` store | conta turnos de Converse |
| `cards` store | conta cards criados |

---

## Modelo de dados no IndexedDB (DB_VERSION 3)

Novas stores:

```
learningPlan   — { id, createdAt, meta: PlanMeta, phases: Phase[], days: DailyTask[] }
activityLog    — { id, ts, type, payload }
effortHistory  — { weekOf, plannedMinutes, actualMinutes, adherenceRate, streak }
```

---

## UX — fluxo do dia a dia

```
App abre → Home screen
           ├─ "Hoje" card → tarefa do dia com botão direto pra aba certa
           ├─ streak + barra de progresso da fase atual
           └─ "X dias para o objetivo"

Tarefa concluída → check animado → próxima tarefa do dia
Semana fechada   → resumo: "Você fez Y% do plano. Aqui está o ajuste para a semana que vem."
```

---

## O que NÃO está escopo aqui

- Geração de conteúdo (o usuário ainda escolhe os vídeos no Discover)
- Gamificação (pontos, badges) — pode vir depois
- Sync na nuvem — tudo continua local-first

---

## Ordem de implementação sugerida

1. **Activity log** — store + emissão nos 4 lugares (sem UI, só infra)
2. **Plan schema + geração** — onboarding do plano, chamada LLM, salva no IndexedDB
3. **Home screen "Hoje"** — mostra tarefa do dia, deeplink para aba
4. **EffortSnapshot semanal** — cálculo automático, exibição simples
5. **Adaptação** — revisão semanal por LLM com base no esforço
