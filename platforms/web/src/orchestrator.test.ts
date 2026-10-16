import { describe, expect, it, vi } from 'vitest';
import { createInitialFlowState } from './flow/controller';
import {
  createSafeFallback,
  parseModelOutput,
  runTurn,
  type BackendGenerator,
} from './orchestrator';
import { auditTurn } from './safety/guardian';

describe('runTurn: safety pre-scan interception', () => {
  it('intercepts red-tier messages immediately without calling backend or mutating state', async () => {
    const backend = vi.fn<BackendGenerator>();
    const state = createInitialFlowState();

    const result = await runTurn({
      userMessage: 'I want to commit suicide right now',
      flowState: state,
      history: [],
      backend,
    });

    expect(result.kind).toBe('crisis');
    if (result.kind === 'crisis') {
      expect(result.tier).toBe('red');
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
      expect(result.crisisMessage).toContain('carrying something really painful');
      expect(result.resources.length).toBeGreaterThan(0);
    }
    expect(backend).not.toHaveBeenCalled();
  });

  it('clamps mode to Steady when amber tier is detected', async () => {
    const state = createInitialFlowState();
    state.phase = 'Explore';
    state.mode = 'Explore';

    const result = await runTurn({
      userMessage: 'I am having a severe panic attack and shaking uncontrollably',
      flowState: state,
      history: [],
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.tier).toBe('amber');
      expect(result.nextState.distress).toBe(true);
      expect(result.nextState.mode).toBe('Steady');
    }
  });
});

describe('runTurn: simulation turn pipeline', () => {
  it('stays in Contract phase and gently re-asks if user input is too short', async () => {
    const state = createInitialFlowState();
    const result = await runTurn({
      userMessage: 'ok',
      flowState: state,
      history: [],
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.decision.action).toBe('stay');
      expect(result.nextState.phase).toBe('Contract');
      expect(result.nextState.shortStreak).toBe(1);
      expect(result.fallbackUsed).toBe(false);
      expect(result.updatedHistory.length).toBe(2);
    }
  });

  it('advances from Contract to CheckIn when user shares a substantive desire', async () => {
    const state = createInitialFlowState();
    const result = await runTurn({
      userMessage: 'I want to feel less overwhelmed by work and more calm.',
      flowState: state,
      history: [],
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.decision.action).toBe('advance');
      expect(result.nextState.phase).toBe('CheckIn');
      expect(result.nextState.contract).toBe(
        'I want to feel less overwhelmed by work and more calm.'
      );
      expect(result.inquiry).toContain(
        'what would feel most gentle and supportive for you to focus on'
      );
    }
  });

  it('advances from Contract to CheckIn with positive energy when user shares a celebratory or happy goal', async () => {
    const state = createInitialFlowState();
    const result = await runTurn({
      userMessage: 'I am feeling really excited and happy because I launched my project today!',
      flowState: state,
      history: [],
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.decision.action).toBe('advance');
      expect(result.nextState.phase).toBe('CheckIn');
      expect(result.technique).toBe('Celebrating Your Energy');
      expect(result.inquiry).toContain('what feels like the best place for us to focus our conversation');
      expect(result.reflection).not.toContain('heavy');
      expect(result.reflection).not.toContain('tired');
    }
  });

  it('advances from Contract to CheckIn with reflective grounding when user shares a practical habit or plan', async () => {
    const state = createInitialFlowState();
    const result = await runTurn({
      userMessage: 'I feel okay today, just trying to organize my morning routine.',
      flowState: state,
      history: [],
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.decision.action).toBe('advance');
      expect(result.nextState.phase).toBe('CheckIn');
      expect(result.technique).toBe('Checking In On You');
      expect(result.inquiry).toContain('what would make this conversation feel most meaningful and helpful for you');
      expect(result.reflection).not.toContain('heavy');
      expect(result.reflection).not.toContain('pain');
    }
  });

  it('incorporates previousStepReview when returning user arrives with a prior committed step', async () => {
    const state = createInitialFlowState();
    const result = await runTurn({
      userMessage: 'I am feeling quite drained and tired today.',
      flowState: state,
      history: [],
      previousStepReview: 'Take a 5-minute walk outside without phone',
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.inquiry).toContain(
        'By the way, were you able to try the little step you set for yourself last time'
      );
      expect(result.inquiry).toContain('Take a 5-minute walk outside');
      expect(result.reflection).toContain('drained');
    }
  });
});

describe('runTurn: real-model backend pipeline (resolves v1 problem 2 & 4)', () => {
  it('advances phase with real model backend when exit criteria are satisfied', async () => {
    const compliantReply = JSON.stringify({
      reflection: 'I hear how tired you are from the long week.',
      question: 'How does your body feel right now as you sit here?',
      full_reply:
        'I hear how tired you are from the long week. How does your body feel right now as you sit here?',
      reflection_present: true,
      advice_given: false,
      risk_tier: 'green',
    });

    const backend = vi.fn<BackendGenerator>().mockResolvedValue(compliantReply);
    const state = createInitialFlowState();

    const result = await runTurn({
      userMessage: 'I want to feel less overwhelmed by my work schedule and feel peaceful.',
      flowState: state,
      history: [],
      backend,
    });

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      // Phase advances in real model mode!
      expect(result.decision.action).toBe('advance');
      expect(result.nextState.phase).toBe('CheckIn');
      expect(result.attempts).toBe(1);
      expect(result.fallbackUsed).toBe(false);
      expect(result.reflection).toBe('I hear how tired you are from the long week.');
    }
  });

  it('retries with corrective instructions when model output fails audit, then succeeds', async () => {
    const invalidReply = JSON.stringify({
      reflection: 'I hear you.',
      question: 'Why did this happen? What will you do next?', // 2 questions!
      full_reply: 'I hear you. Why did this happen? What will you do next?',
      reflection_present: true,
      advice_given: false,
    });

    const correctedReply = JSON.stringify({
      reflection: 'I hear how frustrating that situation is.',
      question: 'What feels most important about this right now?',
      full_reply:
        'I hear how frustrating that situation is. What feels most important about this right now?',
      reflection_present: true,
      advice_given: false,
    });

    const backend = vi
      .fn<BackendGenerator>()
      .mockResolvedValueOnce(invalidReply)
      .mockResolvedValueOnce(correctedReply);

    const state = createInitialFlowState();
    state.phase = 'Explore';

    const result = await runTurn({
      userMessage: 'My manager gave me an impossible deadline yesterday.',
      flowState: state,
      history: [],
      backend,
    });

    expect(backend).toHaveBeenCalledTimes(2);

    // Verify corrective instruction was added in attempt 2 prompt
    const secondCallMessages = backend.mock.calls[1][0];
    const systemPrompt = secondCallMessages[0].content;
    expect(systemPrompt).toContain('CORRECTION: your last reply was rejected');
    expect(systemPrompt).toContain('2 questions');

    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.attempts).toBe(2);
      expect(result.fallbackUsed).toBe(false);
      expect(result.inquiry).toBe('What feels most important about this right now?');
    }
  });

  it('falls back to safe deterministic template when all 3 attempts fail audit', async () => {
    const persistentViolation = JSON.stringify({
      reflection: '', // Missing reflection violation
      question: 'What do you want?',
      full_reply: 'What do you want?',
      reflection_present: false,
      advice_given: false,
    });

    const backend = vi.fn<BackendGenerator>().mockResolvedValue(persistentViolation);
    const state = createInitialFlowState();
    state.phase = 'Explore';

    const result = await runTurn({
      userMessage: 'Everything feels completely disorganized at home.',
      flowState: state,
      history: [],
      backend,
    });

    expect(backend).toHaveBeenCalledTimes(3);
    expect(result.kind).toBe('reply');
    if (result.kind === 'reply') {
      expect(result.attempts).toBe(3);
      expect(result.fallbackUsed).toBe(true);
      expect(result.technique).toBe('Gentle Safe Fallback');
      // Fallback passes audit!
      expect(
        auditTurn(result.decision.replyPhase, result.decision.adviceRequested, result.payload)
      ).toBeNull();
    }
  });
});

describe('createSafeFallback', () => {
  it('produces compliant fallback across Explore, Commit and Close phases', () => {
    const exploreState = createInitialFlowState();
    exploreState.phase = 'Explore';
    const exploreDecision = {
      state: exploreState,
      action: 'stay' as const,
      replyPhase: 'Explore' as const,
      replyKind: 'deepen' as const,
      reason: 'test',
      adviceRequested: false,
      adviceUnlocked: false,
    };
    const exploreFallback = createSafeFallback(exploreDecision);
    expect(auditTurn('Explore', false, exploreFallback)).toBeNull();

    const commitState = createInitialFlowState();
    commitState.phase = 'Commit';
    const commitDecision = {
      state: commitState,
      action: 'stay' as const,
      replyPhase: 'Commit' as const,
      replyKind: 'guide-card' as const,
      reason: 'test',
      adviceRequested: false,
      adviceUnlocked: false,
    };
    const commitFallback = createSafeFallback(commitDecision);
    expect(auditTurn('Commit', false, commitFallback)).toBeNull();
  });
});

describe('parseModelOutput', () => {
  it('parses valid JSON structured output', () => {
    const raw = JSON.stringify({
      reflection: 'That sounds exhausting.',
      question: 'What would help you rest today?',
      full_reply: 'That sounds exhausting. What would help you rest today?',
      reflection_present: true,
      advice_given: false,
    });
    const parsed = parseModelOutput(raw);
    expect(parsed.reflection).toBe('That sounds exhausting.');
    expect(parsed.inquiry).toBe('What would help you rest today?');
    expect(parsed.reflectionPresent).toBe(true);
  });

  it('heuristically parses two-paragraph non-JSON text', () => {
    const raw = 'I hear how difficult this transition has been.\n\nWhat is one small thing you need today?';
    const parsed = parseModelOutput(raw);
    expect(parsed.reflection).toBe('I hear how difficult this transition has been.');
    expect(parsed.inquiry).toBe('What is one small thing you need today?');
    expect(parsed.reflectionPresent).toBe(true);
  });
});
