import { describe, expect, it } from 'vitest';
import {
  MIN_CONFIDENCE_TO_COMMIT,
  confirmCommitment,
  createInitialFlowState,
  decideTurn,
  type FlowDecision,
  type FlowState,
} from './controller';
import { PHASE_ORDER, nextPhase } from './phases';
import type { SessionPhase } from '../types';

function stateAt(phase: SessionPhase, overrides: Partial<FlowState> = {}): FlowState {
  return { ...createInitialFlowState(), phase, ...overrides };
}

function say(state: FlowState, text: string, risk: 'green' | 'amber' = 'green'): FlowDecision {
  return decideTurn(state, { text, risk });
}

describe('phase table', () => {
  it('orders the seven phases and ends at Close', () => {
    expect(PHASE_ORDER).toEqual(['Contract', 'CheckIn', 'Focus', 'Explore', 'Options', 'Commit', 'Close']);
    expect(nextPhase('Contract')).toBe('CheckIn');
    expect(nextPhase('Close')).toBeNull();
  });
});

describe('happy path: the person sets the pace', () => {
  it('walks Contract to Commit, advancing only when enough was shared', () => {
    let d = say(createInitialFlowState(), 'I want more calm in my days');
    expect(d.action).toBe('advance');
    expect(d.state.phase).toBe('CheckIn');
    expect(d.state.contract).toBe('I want more calm in my days');
    expect(d.replyKind).toBe('ask');
    expect(d.state.mode).toBe('Steady');

    d = say(d.state, 'Feeling quite tired');
    expect(d.state.phase).toBe('Focus');

    d = say(d.state, 'My constant worry about work');
    expect(d.state.phase).toBe('Explore');
    expect(d.state.focusTopic).toBe('My constant worry about work');
    expect(d.state.mode).toBe('Explore');

    // Explore needs TWO substantive turns: the first one stays.
    d = say(d.state, 'It started when my manager changed');
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('deepen');
    expect(d.state.phase).toBe('Explore');

    d = say(d.state, 'I feel like I am never enough');
    expect(d.action).toBe('advance');
    expect(d.state.phase).toBe('Options');
    expect(d.state.mode).toBe('Build');

    d = say(d.state, 'The short walk idea feels right');
    expect(d.state.phase).toBe('Commit');
    expect(d.state.actionSeed).toBe('The short walk idea feels right');
    expect(d.state.mode).toBe('Perform');
  });
});

describe('gentle re-ask ladder (stuck handling)', () => {
  it('re-asks, then rephrases, then offers a pause, and never advances on non-answers', () => {
    let d = say(createInitialFlowState(), 'hmm');
    expect(d.replyKind).toBe('reask');
    expect(d.action).toBe('stay');

    d = say(d.state, "I don't know");
    expect(d.replyKind).toBe('rephrase');

    d = say(d.state, 'ok');
    expect(d.replyKind).toBe('offer-pause');
    expect(d.state.phase).toBe('Contract');
  });

  it('resets the ladder once the person shares something real', () => {
    let d = say(createInitialFlowState(), 'hmm');
    d = say(d.state, 'ok');
    expect(d.state.shortStreak).toBe(2);

    d = say(d.state, 'I would like to feel less overwhelmed');
    expect(d.action).toBe('advance');
    expect(d.state.shortStreak).toBe(0);
  });
});

describe('person-led pacing', () => {
  it('"not ready" wins even when the criteria are met, but the sharing still counts', () => {
    let d = say(createInitialFlowState(), "I want to talk about work but I'm not ready to move on yet");
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('honor-hold');
    expect(d.reason).toBe('person_hold');
    expect(d.state.substantiveTurns).toBe(1);

    // A bare "ok" afterwards must NOT sneak the conversation forward.
    d = say(d.state, 'ok');
    expect(d.action).toBe('stay');
    expect(d.state.phase).toBe('Contract');

    // Saying they are ready now moves on, using what they already shared.
    d = say(d.state, "I'm ready");
    expect(d.action).toBe('advance');
    expect(d.reason).toBe('person_ready');
    expect(d.state.phase).toBe('CheckIn');
  });

  it('"ready" before sharing anything invites them to share instead of advancing', () => {
    const d = say(stateAt('CheckIn'), "I'm ready");
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('invite-share');
    expect(d.reason).toBe('ready_but_nothing_shared');
  });

  it('an explicit UI intent can end Explore after a single turn', () => {
    let d = say(stateAt('Explore'), 'It started when my manager changed');
    expect(d.action).toBe('stay');

    d = decideTurn(d.state, { text: '', risk: 'green', intent: 'ready' });
    expect(d.action).toBe('advance');
    expect(d.state.phase).toBe('Options');
    expect(d.reason).toBe('person_ready');
  });

  it('an explicit UI hold intent overrides what the text says', () => {
    const d = decideTurn(stateAt('Contract'), {
      text: 'I want more calm in my days',
      risk: 'green',
      intent: 'hold',
    });
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('honor-hold');
  });
});

describe('advice gate', () => {
  it('declines advice outside Options and does not count it as sharing', () => {
    const d = say(stateAt('Explore'), 'What should I do?');
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('decline-advice');
    expect(d.adviceRequested).toBe(true);
    expect(d.adviceUnlocked).toBe(false);
    expect(d.state.substantiveTurns).toBe(0);
  });

  it('offers options only in Options and only when invited', () => {
    let d = say(stateAt('Options'), 'any ideas?');
    expect(d.replyKind).toBe('offer-options');
    expect(d.adviceUnlocked).toBe(true);
    expect(d.state.phase).toBe('Options');

    d = say(d.state, 'The walking idea feels right');
    expect(d.action).toBe('advance');
    expect(d.state.phase).toBe('Commit');
    expect(d.adviceUnlocked).toBe(false);
  });
});

describe('distress handling', () => {
  it('clamps mode to Steady and holds back action phases until the person eases', () => {
    let d = say(stateAt('Explore'), 'I feel completely hopeless about everything', 'amber');
    expect(d.state.distress).toBe(true);
    expect(d.state.mode).toBe('Steady');
    expect(d.replyKind).toBe('deepen');

    // Criteria met (2 turns) but distress blocks moving into Options.
    d = say(d.state, 'It is mostly about work and money');
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('ground');
    expect(d.reason).toBe('distress_hold');
    expect(d.state.phase).toBe('Explore');

    // Two calm turns in a row ease the distress and the conversation can move on.
    d = say(d.state, 'Talking about it feels a little lighter');
    expect(d.state.distress).toBe(false);
    expect(d.action).toBe('advance');
    expect(d.state.phase).toBe('Options');
    expect(d.state.mode).toBe('Build');
  });

  it('a new amber signal resets the calm counter', () => {
    let d = say(stateAt('Explore', { distress: true, calmTurns: 1 }), 'I am terrified again right now', 'amber');
    expect(d.state.calmTurns).toBe(0);
    expect(d.state.distress).toBe(true);
    d = say(d.state, 'It is a little better now');
    expect(d.state.calmTurns).toBe(1);
    expect(d.state.distress).toBe(true);
  });

  it('does not hold back earlier, non-action phases', () => {
    const d = say(stateAt('Contract', { distress: true }), 'I want to feel steadier again', 'amber');
    expect(d.action).toBe('advance');
    expect(d.state.phase).toBe('CheckIn');
    expect(d.state.mode).toBe('Steady');
  });
});

describe('Commit and Close', () => {
  it('chat messages in Commit point at the card and never advance', () => {
    const d = say(stateAt('Commit'), 'I will go for a walk tomorrow');
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('guide-card');
  });

  it('only confirms a commitment with a step and confidence of at least 8', () => {
    const commit = stateAt('Commit');
    expect(MIN_CONFIDENCE_TO_COMMIT).toBe(8);

    expect(confirmCommitment(commit, '   ', 9).reason).toBe('empty_action');
    expect(confirmCommitment(commit, 'Walk for 5 minutes', 7).reason).toBe('confidence_too_low');
    expect(confirmCommitment(stateAt('Explore'), 'Walk for 5 minutes', 9).reason).toBe('not_in_commit');

    const done = confirmCommitment(commit, '  Walk for 5 minutes ', 8);
    expect(done.action).toBe('advance');
    expect(done.state.phase).toBe('Close');
    expect(done.state.actionSeed).toBe('Walk for 5 minutes');
    expect(done.replyKind).toBe('closing');
  });

  it('a closed session stays closed', () => {
    const d = say(stateAt('Close'), 'one more thing before I go');
    expect(d.action).toBe('stay');
    expect(d.replyKind).toBe('closed');
    expect(d.state.phase).toBe('Close');
  });
});

describe('purity', () => {
  it('never mutates the state it is given', () => {
    const frozen = Object.freeze(stateAt('Explore', { substantiveTurns: 1 }));
    expect(() => say(frozen, 'I feel like I am never enough')).not.toThrow();
    expect(() => say(frozen, 'What should I do?')).not.toThrow();
    expect(() => say(frozen, 'hmm', 'amber')).not.toThrow();
    expect(() => confirmCommitment(Object.freeze(stateAt('Commit')), 'Walk', 9)).not.toThrow();
    expect(frozen.substantiveTurns).toBe(1);
    expect(frozen.phase).toBe('Explore');
  });

  it('is deterministic', () => {
    const a = say(stateAt('Focus'), 'My constant worry about work');
    const b = say(stateAt('Focus'), 'My constant worry about work');
    expect(a).toEqual(b);
  });
});
