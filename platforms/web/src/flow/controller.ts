/**
 * Flow controller: decides, for each message, whether the conversation stays or moves on.
 *
 * `decideTurn` and `confirmCommitment` are PURE: they never mutate their input, touch React,
 * or perform I/O. The caller applies the returned state. This is what makes pacing testable.
 *
 * The person sets the pace:
 *   - a phase only advances on a turn where they actually shared something (or said they are ready);
 *   - "not ready" always wins;
 *   - distress holds back anything action-oriented;
 *   - Haven never gives advice outside the Options phase, and only when invited.
 */
import type { OperatingMode, SessionPhase } from '../types';
import { PHASE_SPECS, isActionPhase, modeFor, nextPhase } from './phases';
import { countWords, detectIntent, invitesAdvice, isNonAnswer, type PersonIntent } from './signals';

/** Rust parity: an action below this confidence must be shrunk before committing. */
export const MIN_CONFIDENCE_TO_COMMIT = 8;
/** Calm, substantive turns in a row needed before distress is considered eased. */
export const CALM_TURNS_TO_CLEAR_DISTRESS = 2;

export interface FlowState {
  phase: SessionPhase;
  mode: OperatingMode;
  /** Substantive turns given in the current phase. */
  substantiveTurns: number;
  /** Consecutive short or non-answer turns. Drives the gentle re-ask ladder. */
  shortStreak: number;
  /** Consecutive calm substantive turns since the last distress signal. */
  calmTurns: number;
  distress: boolean;
  /** Most recent substantive message in the current phase. */
  lastSubstantive?: string;
  /** Captured when leaving Contract. */
  contract?: string;
  /** Captured when leaving Focus. */
  focusTopic?: string;
  /** Captured when leaving Options; used to pre-fill the little-step card. */
  actionSeed?: string;
}

export interface FlowInput {
  text: string;
  /** Red never reaches the flow: the guardian intercepts it first. */
  risk: 'green' | 'amber';
  /** Explicit pacing choice from a UI control. Overrides intent detected in the text. */
  intent?: PersonIntent;
}

/** What the coach's reply should DO this turn. The dialogue layer turns this into words. */
export type ReplyKind =
  | 'ask' // just entered a new phase: ask its opening question
  | 'deepen' // staying: gather a little more in this phase
  | 'reask' // staying: they gave very little, ask again gently
  | 'rephrase' // staying: still stuck, offer a simpler way in
  | 'offer-pause' // staying: it is okay to rest and come back
  | 'honor-hold' // person asked to slow down: say so warmly
  | 'invite-share' // person said ready before sharing anything
  | 'decline-advice' // advice asked for outside Options: warmly decline
  | 'offer-options' // Options + invited: offer two or three ideas
  | 'ground' // distress: stay and steady, no action planning
  | 'guide-card' // Commit: point at the little-step card
  | 'closing' // wrapped up
  | 'closed'; // already closed

export interface FlowDecision {
  state: FlowState;
  action: 'stay' | 'advance';
  /** Phase whose voice the reply should use (the NEW phase when advancing). */
  replyPhase: SessionPhase;
  replyKind: ReplyKind;
  /** Stable machine-readable reason, used in tests and the changelog of decisions. */
  reason: string;
  /** The person asked for advice or ideas this turn. Feeds the guardian audit. */
  adviceRequested: boolean;
  /** Advice may be given this turn (Options phase and the person invited it). */
  adviceUnlocked: boolean;
}

export function createInitialFlowState(): FlowState {
  return {
    phase: 'Contract',
    mode: modeFor('Contract', false),
    substantiveTurns: 0,
    shortStreak: 0,
    calmTurns: 0,
    distress: false,
  };
}

function stay(
  next: FlowState,
  replyKind: ReplyKind,
  reason: string,
  flags: { adviceRequested?: boolean; adviceUnlocked?: boolean } = {}
): FlowDecision {
  return {
    state: { ...next, mode: modeFor(next.phase, next.distress) },
    action: 'stay',
    replyPhase: next.phase,
    replyKind,
    reason,
    adviceRequested: flags.adviceRequested ?? false,
    adviceUnlocked: flags.adviceUnlocked ?? false,
  };
}

function advance(
  from: FlowState,
  next: FlowState,
  to: SessionPhase,
  replyKind: ReplyKind,
  reason: string
): FlowDecision {
  const moved: FlowState = {
    ...next,
    phase: to,
    substantiveTurns: 0,
    shortStreak: 0,
    lastSubstantive: undefined,
  };
  // Capture what the person gave us in the phase we are leaving.
  const captured = next.lastSubstantive;
  if (from.phase === 'Contract') moved.contract = captured;
  if (from.phase === 'Focus') moved.focusTopic = captured;
  if (from.phase === 'Options') moved.actionSeed = captured;

  return {
    state: { ...moved, mode: modeFor(to, moved.distress) },
    action: 'advance',
    replyPhase: to,
    replyKind,
    reason,
    adviceRequested: false,
    adviceUnlocked: false,
  };
}

export function decideTurn(state: FlowState, input: FlowInput): FlowDecision {
  const text = input.text.trim();
  const intent: PersonIntent = input.intent !== undefined ? input.intent : detectIntent(text);
  const adviceAsk = invitesAdvice(text);
  const spec = PHASE_SPECS[state.phase];

  const next: FlowState = { ...state };

  // Distress is tracked on every turn, whatever else happens.
  if (input.risk === 'amber') {
    next.distress = true;
    next.calmTurns = 0;
  }

  // Commit is driven by the little-step card, and a closed session stays closed.
  if (state.phase === 'Close') return stay(next, 'closed', 'session_closed');
  if (state.phase === 'Commit') return stay(next, 'guide-card', 'commit_via_card');

  // Advice gate. Asking for advice is not "sharing", so it never counts toward moving on.
  if (adviceAsk) {
    if (state.phase === 'Options') {
      return stay(next, 'offer-options', 'advice_invited', {
        adviceRequested: true,
        adviceUnlocked: true,
      });
    }
    return stay(next, 'decline-advice', 'advice_gate_locked', { adviceRequested: true });
  }

  const substantive =
    intent !== 'ready' && !isNonAnswer(text) && countWords(text) >= spec.minWords;

  if (substantive) {
    next.substantiveTurns = state.substantiveTurns + 1;
    next.lastSubstantive = text;
    next.shortStreak = 0;
    if (input.risk === 'green') {
      next.calmTurns = state.calmTurns + 1;
      if (next.distress && next.calmTurns >= CALM_TURNS_TO_CLEAR_DISTRESS) {
        next.distress = false;
      }
    }
  } else if (intent === null) {
    next.shortStreak = state.shortStreak + 1;
  }

  // "Not ready" always wins, even when the criteria are met.
  if (intent === 'hold') {
    next.shortStreak = 0;
    return stay(next, 'honor-hold', 'person_hold');
  }

  if (intent === 'ready' && next.substantiveTurns === 0) {
    return stay(next, 'invite-share', 'ready_but_nothing_shared');
  }

  const criteriaMet = next.substantiveTurns >= spec.minTurns;
  const readyOverride = intent === 'ready' && next.substantiveTurns >= 1;
  // Only a turn with real content, or an explicit "ready", can move the conversation forward.
  const canAdvance = (substantive || intent === 'ready') && (criteriaMet || readyOverride);

  if (canAdvance) {
    const target = nextPhase(state.phase);
    if (target !== null) {
      if (next.distress && isActionPhase(target)) {
        return stay(next, 'ground', 'distress_hold');
      }
      return advance(state, next, target, 'ask', intent === 'ready' ? 'person_ready' : 'criteria_met');
    }
  }

  if (substantive) return stay(next, 'deepen', 'gathering_more');
  if (next.shortStreak >= 3) return stay(next, 'offer-pause', 'stuck_offer_pause');
  if (next.shortStreak === 2) return stay(next, 'rephrase', 'stuck_rephrase');
  return stay(next, 'reask', 'too_little_shared');
}

/**
 * Called when the person confirms their little step on the card.
 * The confidence rule lives here (not in the UI) and mirrors the Rust state machine.
 */
export function confirmCommitment(
  state: FlowState,
  planText: string,
  confidence: number
): FlowDecision {
  const plan = planText.trim();

  if (state.phase !== 'Commit') return stay({ ...state }, 'guide-card', 'not_in_commit');
  if (plan === '') return stay({ ...state }, 'guide-card', 'empty_action');
  if (confidence < MIN_CONFIDENCE_TO_COMMIT) {
    return stay({ ...state }, 'guide-card', 'confidence_too_low');
  }

  return advance(state, { ...state, actionSeed: plan }, 'Close', 'closing', 'commitment_confirmed');
}
