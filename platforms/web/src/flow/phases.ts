/**
 * Phase table for the 7-phase coaching journey.
 *
 * This is the single place that says how much a person needs to share before a phase can move on.
 * Tuning pacing means editing these numbers, nothing else.
 */
import type { OperatingMode, SessionPhase } from '../types';

export const PHASE_ORDER: readonly SessionPhase[] = [
  'Contract',
  'CheckIn',
  'Focus',
  'Explore',
  'Options',
  'Commit',
  'Close',
];

export interface PhaseSpec {
  /** Substantive turns the person must give before the phase can advance by itself. */
  minTurns: number;
  /** Words a turn needs to count as substantive in this phase. */
  minWords: number;
  /** Operating mode used while in this phase (when the person is not in distress). */
  mode: OperatingMode;
}

export const PHASE_SPECS: Readonly<Record<SessionPhase, PhaseSpec>> = {
  Contract: { minTurns: 1, minWords: 4, mode: 'Steady' },
  CheckIn: { minTurns: 1, minWords: 2, mode: 'Steady' },
  Focus: { minTurns: 1, minWords: 3, mode: 'Explore' },
  Explore: { minTurns: 2, minWords: 4, mode: 'Explore' },
  Options: { minTurns: 1, minWords: 2, mode: 'Build' },
  // Commit and Close are not advanced by chat messages (see controller).
  Commit: { minTurns: 1, minWords: 1, mode: 'Perform' },
  Close: { minTurns: 0, minWords: 0, mode: 'Steady' },
};

/** The phase after `phase`, or `null` when `phase` is the last one. */
export function nextPhase(phase: SessionPhase): SessionPhase | null {
  const index = PHASE_ORDER.indexOf(phase);
  return index >= 0 && index < PHASE_ORDER.length - 1 ? PHASE_ORDER[index + 1] : null;
}

/** Phases that plan or commit to action. These are held back while the person is in distress. */
export function isActionPhase(phase: SessionPhase): boolean {
  return PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf('Options');
}

/** Distress always clamps the mode to Steady, matching the Rust state machine. */
export function modeFor(phase: SessionPhase, distress: boolean): OperatingMode {
  return distress ? 'Steady' : PHASE_SPECS[phase].mode;
}
