import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearJourneyStorage,
  getLastStep,
  markLastStepReviewed,
  saveLastStep,
} from './journeyStorage';

describe('journeyStorage', () => {
  beforeEach(() => {
    clearJourneyStorage();
  });

  afterEach(() => {
    clearJourneyStorage();
  });

  it('returns null when no step is saved', () => {
    expect(getLastStep()).toBeNull();
  });

  it('saves and retrieves the last committed step', () => {
    saveLastStep('Drink a glass of water and stretch', 9);
    const step = getLastStep();
    expect(step).not.toBeNull();
    expect(step?.plan).toBe('Drink a glass of water and stretch');
    expect(step?.confidence).toBe(9);
    expect(step?.reviewed).toBe(false);
    expect(step?.timestamp).toBeGreaterThan(0);
  });

  it('ignores empty step strings', () => {
    saveLastStep('   ', 9);
    expect(getLastStep()).toBeNull();
  });

  it('marks a step as reviewed', () => {
    saveLastStep('Take 3 deep breaths', 10);
    expect(getLastStep()?.reviewed).toBe(false);

    markLastStepReviewed();
    expect(getLastStep()?.reviewed).toBe(true);
  });

  it('clears storage completely on panic wipe / reset', () => {
    saveLastStep('Go for a 5 minute walk', 8);
    expect(getLastStep()).not.toBeNull();

    clearJourneyStorage();
    expect(getLastStep()).toBeNull();
  });
});
