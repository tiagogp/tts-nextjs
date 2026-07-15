import {
  getListeningAttempts,
  getMethodProgression,
  getProductionAttempts,
  getRetryOutcomes,
  saveMethodProgression,
} from "@/lib/store/repository";
import { deriveProgressionState, type MethodProgressionState } from "./progression";

/**
 * Recompute the durable support snapshot from the source-of-truth evidence.
 *
 * Evidence writers call this indirectly through the app-level
 * `phraseloop:performance-evidence` event, so support changes as soon as an
 * attempt has been stored instead of waiting for the Progress screen to open.
 */
export async function refreshMethodProgression(): Promise<MethodProgressionState> {
  const [listeningAttempts, productionAttempts, retryOutcomes, previous] = await Promise.all([
    getListeningAttempts(),
    getProductionAttempts(),
    getRetryOutcomes(),
    getMethodProgression(),
  ]);
  const progression = deriveProgressionState({
    listeningAttempts,
    productionAttempts,
    retryOutcomes,
    previous,
  });
  await saveMethodProgression(progression);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("phraseloop:progress-updated"));
  }
  return progression;
}
