"use client";

import { useSyncExternalStore } from "react";
import type { ProviderKind } from "@/lib/cards/provider";
import { generateAndSavePlan } from "./generator";
import type { LearningPlan, PlanMeta } from "./schema";

/**
 * Plan generation runs as a background job, not inside the onboarding modal.
 *
 * It is a long chain of provider calls, and holding the learner on a spinner for
 * all of it wastes their session: nothing about the rest of the app depends on
 * the plan being ready. The job therefore lives at module scope, survives the
 * modal unmounting, and announces itself through a toast when it finishes.
 */

export interface PlanGenerationRequest {
  meta: PlanMeta;
  provider: ProviderKind;
  ollamaModel?: string;
}

export type PlanJobState =
  | { status: "idle" }
  | { status: "running"; planDays: number; completedDays: number }
  | { status: "done"; plan: LearningPlan }
  | { status: "error"; message: string };

const IDLE: PlanJobState = { status: "idle" };

let state: PlanJobState = IDLE;
let lastRequest: PlanGenerationRequest | null = null;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function setState(next: PlanJobState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlanJobState(): PlanJobState {
  return state;
}

export function isPlanGenerationRunning(): boolean {
  return state.status === "running";
}

async function run(request: PlanGenerationRequest): Promise<void> {
  lastRequest = request;
  controller = new AbortController();
  const signal = controller.signal;
  setState({ status: "running", planDays: request.meta.planDays, completedDays: 0 });

  try {
    const plan = await generateAndSavePlan({
      ...request,
      signal,
      onProgress: (completedDays, totalDays) => {
        if (signal.aborted) return;
        setState({ status: "running", planDays: totalDays, completedDays });
      },
    });
    if (signal.aborted) return;
    setState({ status: "done", plan });
  } catch (err: unknown) {
    if (signal.aborted) {
      setState(IDLE);
      return;
    }
    setState({
      status: "error",
      message: err instanceof Error && err.message ? err.message : "plan-generation-failed",
    });
  } finally {
    if (controller?.signal === signal) controller = null;
  }
}

/** Start generating in the background. Ignored while another run is in flight. */
export function startPlanGeneration(request: PlanGenerationRequest): void {
  if (state.status === "running") return;
  void run(request);
}

export function retryPlanGeneration(): void {
  if (state.status === "running" || !lastRequest) return;
  void run(lastRequest);
}

export function cancelPlanGeneration(): void {
  controller?.abort();
  controller = null;
  setState(IDLE);
}

/** Clear a finished job so its toast goes away. */
export function dismissPlanGeneration(): void {
  if (state.status === "running") return;
  setState(IDLE);
}

export function usePlanGenerationJob(): PlanJobState {
  return useSyncExternalStore(subscribe, getPlanJobState, () => IDLE);
}
