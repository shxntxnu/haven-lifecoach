import { describe, expect, it } from 'vitest';
import {
  HISTORY_MAX_TURNS,
  buildMessages,
  buildSystemPrompt,
  windowHistory,
  type DialogueTurn,
  type PromptContext,
} from './builder';

function context(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    phase: 'Explore',
    mode: 'Explore',
    replyKind: 'deepen',
    adviceUnlocked: false,
    history: [],
    ...overrides,
  };
}

const person = (text: string): DialogueTurn => ({ speaker: 'person', text });
const haven = (text: string): DialogueTurn => ({ speaker: 'haven', text });

describe('buildSystemPrompt', () => {
  it('fills the slots', () => {
    const prompt = buildSystemPrompt(
      context({ contract: 'More calm in my days', focusTopic: 'Worry about work' })
    );
    expect(prompt).toContain('CURRENT PHASE: Explore');
    expect(prompt).toContain('ACTIVE MODE: Explore');
    expect(prompt).toContain('SESSION CONTRACT: More calm in my days');
    expect(prompt).toContain('WHAT MATTERS MOST TO THEM: Worry about work');
  });

  it('says so when no contract exists yet and omits the focus line', () => {
    const prompt = buildSystemPrompt(context());
    expect(prompt).toContain('SESSION CONTRACT: None established yet');
    expect(prompt).not.toContain('WHAT MATTERS MOST TO THEM');
  });

  it('locks the advice gate unless the person invited ideas in Options', () => {
    expect(buildSystemPrompt(context())).toContain('DO NOT give advice');
    expect(buildSystemPrompt(context({ phase: 'Options', adviceUnlocked: false }))).toContain('DO NOT give advice');

    const unlocked = buildSystemPrompt(context({ phase: 'Options', adviceUnlocked: true }));
    expect(unlocked).toContain('ADVICE IS ALLOWED');
    expect(unlocked).not.toContain('DO NOT give advice');
  });

  it('never unlocks advice outside Options, even if the flag is set', () => {
    const prompt = buildSystemPrompt(context({ phase: 'Explore', adviceUnlocked: true }));
    expect(prompt).toContain('DO NOT give advice');
    expect(prompt).not.toContain('ADVICE IS ALLOWED');
  });

  it('keeps Steady mode short and only Steady mode', () => {
    expect(buildSystemPrompt(context({ mode: 'Steady' }))).toContain('under 3 sentences');
    expect(buildSystemPrompt(context({ mode: 'Explore' }))).not.toContain('under 3 sentences');
  });

  it('always demands a clear next step so the person is never left unsure', () => {
    expect(buildSystemPrompt(context())).toContain('ONE clear instruction about what to do next');
  });

  it('injects corrective guidance on a retry', () => {
    const prompt = buildSystemPrompt(context({ correctiveInstruction: 'Your reply contained 2 questions.' }));
    expect(prompt).toContain('CORRECTION');
    expect(prompt).toContain('Your reply contained 2 questions.');
  });

  it('describes the task for the reply kind', () => {
    expect(buildSystemPrompt(context({ replyKind: 'decline-advice' }))).toContain('will not tell them what to do');
    expect(buildSystemPrompt(context({ replyKind: 'ground' }))).toContain('one slow breath');
    expect(buildSystemPrompt(context({ replyKind: 'ask', phase: 'Focus' }))).toContain('Never choose the topic');
  });

  it('asks for the same JSON shape the Rust guardian audits', () => {
    const prompt = buildSystemPrompt(context());
    for (const key of ['reflection', 'question', 'full_reply', 'reflection_present', 'advice_given', 'risk_tier']) {
      expect(prompt).toContain(`"${key}"`);
    }
  });
});

describe('buildMessages: the model sees the whole conversation (v1 problem 3)', () => {
  it('sends system, then history in order, then the new message last', () => {
    const messages = buildMessages(
      context({
        history: [haven('What is on your heart?'), person('Work feels heavy'), haven('That sounds tiring. What part is heaviest?')],
      }),
      'The constant deadlines'
    );

    expect(messages.map((m) => m.role)).toEqual(['system', 'assistant', 'user', 'assistant', 'user']);
    expect(messages[2].content).toBe('Work feels heavy');
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'The constant deadlines' });
  });

  it('merges consecutive turns by the same speaker so roles alternate', () => {
    const messages = buildMessages(context({ history: [person('First thought'), person('Second thought')] }), 'Third');
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(messages[1].content).toBe('First thought\nSecond thought\nThird');
  });

  it('does not duplicate the current message if the caller already appended it', () => {
    const messages = buildMessages(
      context({ history: [haven('Hello'), person('I feel tired')] }),
      'I feel tired'
    );
    expect(messages.filter((m) => m.content.includes('I feel tired'))).toHaveLength(1);
  });

  it('works with an empty history', () => {
    const messages = buildMessages(context(), 'Hello');
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: 'user', content: 'Hello' });
  });
});

describe('windowHistory', () => {
  it('keeps only the most recent turns', () => {
    const turns = Array.from({ length: HISTORY_MAX_TURNS + 6 }, (_, i) => person(`turn ${i}`));
    const windowed = windowHistory(turns);
    expect(windowed).toHaveLength(HISTORY_MAX_TURNS);
    expect(windowed[windowed.length - 1].text).toBe(`turn ${HISTORY_MAX_TURNS + 5}`);
  });

  it('drops the oldest turns first when over the character budget', () => {
    const turns = [person('a'.repeat(100)), person('b'.repeat(100)), person('c'.repeat(100))];
    const windowed = windowHistory(turns, 10, 250);
    expect(windowed.map((t) => t.text[0])).toEqual(['\u2026', 'b', 'c']);
    expect(windowed[1].text).toBe('b'.repeat(100));
    expect(windowed[2].text).toBe('c'.repeat(100));
  });

  it('truncates the START of an over-long oldest turn and keeps its end', () => {
    const windowed = windowHistory([person(`${'x'.repeat(100)}END`)], 10, 50);
    expect(windowed).toHaveLength(1);
    expect(windowed[0].text.startsWith('\u2026')).toBe(true);
    expect(windowed[0].text.endsWith('END')).toBe(true);
    expect(windowed[0].text.length).toBeLessThanOrEqual(50);
  });

  it('never exceeds the character budget and does not mutate its input', () => {
    const turns = [person('a'.repeat(90)), person('b'.repeat(90))];
    const copy = turns.map((t) => ({ ...t }));
    const windowed = windowHistory(turns, 10, 120);
    expect(windowed.reduce((sum, t) => sum + t.text.length, 0)).toBeLessThanOrEqual(120);
    expect(turns).toEqual(copy);
  });

  it('returns an empty window for empty history', () => {
    expect(windowHistory([])).toEqual([]);
  });
});
