import { describe, expect, it } from 'vitest';
import { createInitialFlowState, type FlowDecision, type ReplyKind } from '../flow/controller';
import { auditTurn } from '../safety/guardian';
import type { SessionPhase } from '../types';
import { generateSimulatedTurn } from './dialogue';

const ALL_PHASES: SessionPhase[] = [
  'Contract',
  'CheckIn',
  'Focus',
  'Explore',
  'Options',
  'Commit',
  'Close',
];

const ALL_REPLY_KINDS: ReplyKind[] = [
  'ask',
  'deepen',
  'reask',
  'rephrase',
  'offer-pause',
  'honor-hold',
  'invite-share',
  'decline-advice',
  'offer-options',
  'ground',
  'guide-card',
  'closing',
  'closed',
];

function makeDecision(
  replyPhase: SessionPhase,
  replyKind: ReplyKind,
  adviceUnlocked = false
): FlowDecision {
  const state = createInitialFlowState();
  state.phase = replyPhase;
  state.contract = 'More calm in my days';
  state.focusTopic = 'Work deadlines';
  return {
    state,
    action: 'stay',
    replyPhase,
    replyKind,
    reason: 'test',
    adviceRequested: adviceUnlocked,
    adviceUnlocked,
  };
}

describe('generateSimulatedTurn', () => {
  it('generates an audited, compliant turn for all reply kinds', () => {
    for (const kind of ALL_REPLY_KINDS) {
      const phase: SessionPhase = kind === 'offer-options' ? 'Options' : 'Explore';
      const adviceUnlocked = kind === 'offer-options';
      const decision = makeDecision(phase, kind, adviceUnlocked);
      const turn = generateSimulatedTurn(decision, 'I feel really stretched thin with work.');

      expect(turn.reflectionPresent).toBe(true);
      expect(turn.reflection.length).toBeGreaterThan(10);
      expect(turn.fullReply).toContain(turn.reflection);

      // Must pass guardian audit!
      const violation = auditTurn(phase, decision.adviceRequested, turn);
      expect(violation).toBeNull();
    }
  });

  it('generates compliant turns for "ask" across every phase', () => {
    for (const phase of ALL_PHASES) {
      const decision = makeDecision(phase, 'ask');
      const turn = generateSimulatedTurn(decision, 'Here is my thoughts.');
      const violation = auditTurn(phase, false, turn);
      expect(violation).toBeNull();
      expect(turn.technique.length).toBeGreaterThan(0);
    }
  });

  it('generates compliant turns for "deepen" across every phase', () => {
    for (const phase of ALL_PHASES) {
      const decision = makeDecision(phase, 'deepen');
      const turn = generateSimulatedTurn(decision, 'I am feeling overwhelmed by tasks.');
      const violation = auditTurn(phase, false, turn);
      expect(violation).toBeNull();
    }
  });

  it('only sets adviceGiven to true for offer-options', () => {
    const optionsTurn = generateSimulatedTurn(
      makeDecision('Options', 'offer-options', true),
      'Any ideas?'
    );
    expect(optionsTurn.adviceGiven).toBe(true);
    expect(auditTurn('Options', true, optionsTurn)).toBeNull();

    const exploreTurn = generateSimulatedTurn(
      makeDecision('Explore', 'decline-advice', false),
      'Tell me what to do.'
    );
    expect(exploreTurn.adviceGiven).toBe(false);
    expect(auditTurn('Explore', false, exploreTurn)).toBeNull();
  });

  it('includes context from session contract and focus topic when available', () => {
    const checkIn = generateSimulatedTurn(
      makeDecision('CheckIn', 'ask'),
      'I want peace.'
    );
    expect(checkIn.reflection).toContain('More calm in my days');

    const explore = generateSimulatedTurn(
      makeDecision('Explore', 'ask'),
      'Deadlines are tough.'
    );
    expect(explore.reflection).toContain('Work deadlines');
  });
});
