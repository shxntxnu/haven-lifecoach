import { describe, expect, it } from 'vitest';
import { createInitialFlowState, type FlowDecision, type ReplyKind } from '../flow/controller';
import { auditTurn } from '../safety/guardian';
import type { SessionPhase } from '../types';
import {
  classifyTone,
  extractTopicPhrase,
  generateSimulatedTurn,
} from './dialogue';

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

  it('generates emotionally attuned reflections for various emotional states', () => {
    const exhaustion = generateSimulatedTurn(
      makeDecision('Contract', 'ask'),
      'I am feeling completely exhausted and overwhelmed by everything.'
    );
    expect(exhaustion.reflection).toContain('energy this has been taking out of you');

    const anxiety = generateSimulatedTurn(
      makeDecision('Contract', 'ask'),
      'I have so much anxiety and worry racing in my head.'
    );
    expect(anxiety.reflection).toContain('mind has been spinning');

    const sadness = generateSimulatedTurn(
      makeDecision('Contract', 'ask'),
      'I just feel so sad and lonely right now.'
    );
    expect(sadness.reflection).toContain('sadness is resting with you');

    const frustration = generateSimulatedTurn(
      makeDecision('Contract', 'ask'),
      'I am so angry and frustrated about the argument.'
    );
    expect(frustration.reflection).toContain('frustrated and upset');

    const peaceDesire = generateSimulatedTurn(
      makeDecision('Contract', 'ask'),
      'I just want some peace and quiet breathing room.'
    );
    expect(peaceDesire.reflection).toContain('craving some quiet breathing room');
  });

  it('incorporates previousStepReview gently into Contract or CheckIn phase inquiry', () => {
    const turn = generateSimulatedTurn(
      makeDecision('Contract', 'ask'),
      'I am feeling a little better today.',
      'Drink a glass of water when waking up'
    );
    expect(turn.inquiry).toContain(
      'By the way, were you able to try the little step you set for yourself last time: "Drink a glass of water'
    );
  });

  it('correctly classifies emotional valence and tone', () => {
    expect(classifyTone('I am feeling so excited and happy about my new job!')).toBe('positive');
    expect(classifyTone('I am feeling completely exhausted and overwhelmed.')).toBe('vulnerable');
    expect(classifyTone('I feel okay today, just trying to organize my weekly routine.')).toBe('reflective');
  });

  it('extracts topic phrases cleanly without conversational clutter', () => {
    expect(extractTopicPhrase('I want to feel less overwhelmed by work')).toBe('feel less overwhelmed by work');
    expect(extractTopicPhrase("I'm feeling really good and want to write my book")).toBe('write my book');
    expect(extractTopicPhrase('I just want some peace and quiet')).toBe('peace and quiet');
  });

  it('adapts CheckIn and Explore naturally to positive topics without assuming suffering', () => {
    const positiveCheckIn = generateSimulatedTurn(
      makeDecision('CheckIn', 'ask'),
      'I feel amazing today and want to celebrate finishing my project!'
    );
    expect(positiveCheckIn.technique).toBe('Celebrating Your Energy');
    expect(positiveCheckIn.inquiry).toContain('what feels like the best place for us to focus our conversation');
    expect(positiveCheckIn.reflection).not.toContain('heavy');
    expect(positiveCheckIn.reflection).not.toContain('tired');

    const positiveExplore = generateSimulatedTurn(
      makeDecision('Explore', 'ask'),
      'Writing my book chapter feels so inspiring.'
    );
    expect(positiveExplore.technique).toBe('Looking Deeper');
    expect(positiveExplore.inquiry).toContain('What makes this feel so meaningful to you');
  });
});
