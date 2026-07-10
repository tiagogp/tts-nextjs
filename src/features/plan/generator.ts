import type { ProviderKind } from "@/lib/cards/provider";
import type { PlanMeta, PlanGenerationResult, LearningPlan } from "./schema";
import { buildPlan, savePlan } from "./store";

export interface GeneratePlanOptions {
  meta: PlanMeta;
  provider: ProviderKind;
  ollamaModel?: string;
}

export async function generateAndSavePlan(opts: GeneratePlanOptions): Promise<LearningPlan> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goal: opts.meta.goal,
      currentLevel: opts.meta.currentLevel,
      targetLevel: opts.meta.targetLevel,
      availabilityMinutes: opts.meta.availabilityMinutes,
      planDays: opts.meta.planDays,
      language: opts.meta.language,
      provider: opts.provider,
      ollamaModel: opts.ollamaModel || undefined,
    }),
  });

  const data = (await res.json().catch(() => null)) as { plan?: PlanGenerationResult; error?: string } | null;
  if (!res.ok || !data?.plan) {
    throw new Error(data?.error ?? `Plan generation failed (${res.status})`);
  }

  const plan = buildPlan(opts.meta, data.plan);
  await savePlan(plan);
  return plan;
}
