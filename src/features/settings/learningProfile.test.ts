import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeOnboarding,
  getLearningProfile,
  isOnboardingComplete,
  saveLearningProfile,
} from "@/features/settings/learningProfile";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installStorage() {
  const store = new MemoryStorage();
  vi.stubGlobal("localStorage", store);
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("learning profile", () => {
  it("returns defaults when storage is empty", () => {
    installStorage();
    expect(getLearningProfile()).toMatchObject({
      level: "B2",
      focus: "",
      goal: 3,
      onboardingCompleted: false,
    });
  });

  it("clamps the weekly goal and persists it through the existing goal key", () => {
    const store = installStorage();
    const profile = saveLearningProfile({ goal: 99 });
    expect(profile.goal).toBe(30);
    expect(store.getItem("phraseloop.weeklyGoal")).toBe("30");
  });

  it("persists and reloads level, focus, and completion", () => {
    installStorage();
    completeOnboarding({
      level: "C1",
      focus: "job interviews",
      goal: 4,
      createdAt: 123,
    });
    expect(isOnboardingComplete()).toBe(true);
    expect(getLearningProfile()).toMatchObject({
      level: "C1",
      focus: "job interviews",
      goal: 4,
      createdAt: 123,
      onboardingCompleted: true,
    });
  });

  it("falls back safely when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(getLearningProfile()).toMatchObject({
      level: "B2",
      goal: 3,
      onboardingCompleted: false,
    });
    expect(() => saveLearningProfile({ focus: "travel" })).not.toThrow();
  });
});
