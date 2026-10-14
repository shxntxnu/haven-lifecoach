/**
 * Lightweight on-device persistence for cross-session continuity.
 *
 * Saves the client's last committed little step so Haven can warmly check in
 * on returning visits without requiring logins or external network egress.
 */

const STORAGE_KEY = 'haven_journey_v2';

export interface LastStepRecord {
  plan: string;
  confidence: number;
  timestamp: number;
  reviewed: boolean;
}

interface JourneyStore {
  lastStep?: LastStepRecord;
}

let inMemoryFallback: Record<string, string> = {};

function getItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fall back to memory
  }
  return inMemoryFallback[key] ?? null;
}

function setItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fall back to memory
  }
  inMemoryFallback[key] = value;
}

function removeItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch {
    // Fall back to memory
  }
  delete inMemoryFallback[key];
}

function getStore(): JourneyStore {
  try {
    const raw = getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function setStore(store: JourneyStore): void {
  try {
    setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Gracefully handle storage quota or private browsing exceptions
  }
}

export function getLastStep(): LastStepRecord | null {
  const store = getStore();
  return store.lastStep ?? null;
}

export function saveLastStep(plan: string, confidence: number): void {
  const cleanPlan = plan.trim();
  if (!cleanPlan) return;

  const store = getStore();
  store.lastStep = {
    plan: cleanPlan,
    confidence,
    timestamp: Date.now(),
    reviewed: false,
  };
  setStore(store);
}

export function markLastStepReviewed(): void {
  const store = getStore();
  if (store.lastStep) {
    store.lastStep.reviewed = true;
    setStore(store);
  }
}

export function clearJourneyStorage(): void {
  removeItem(STORAGE_KEY);
  inMemoryFallback = {};
}
