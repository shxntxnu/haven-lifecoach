import { describe, expect, it } from 'vitest';
import { countWords, detectIntent, invitesAdvice, isNonAnswer } from './signals';

describe('countWords', () => {
  it('counts plain words and ignores punctuation', () => {
    expect(countWords('I want more calm.')).toBe(4);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('treats contractions as one word, including curly apostrophes', () => {
    expect(countWords("I don't know")).toBe(3);
    expect(countWords('I don\u2019t know')).toBe(3);
  });
});

describe('isNonAnswer', () => {
  it.each(['', '   ', "I don't know", 'idk', 'not sure', 'ok', 'Fine.', 'nothing', 'no idea'])(
    'treats %j as a non-answer',
    (text) => {
      expect(isNonAnswer(text)).toBe(true);
    }
  );

  it.each([
    "I'm not sure how I feel, maybe tired and a bit scared of tomorrow",
    'I feel overwhelmed at work lately',
    'My manager keeps changing the plan',
  ])('treats %j as a real answer', (text) => {
    expect(isNonAnswer(text)).toBe(false);
  });
});

describe('detectIntent', () => {
  it.each([
    'ready',
    "I'm ready",
    'I am ready to move on',
    "Yes, I'm ready",
    'next',
    "let's move on",
    'Let\u2019s move on.',
    'keep going',
  ])('detects ready for %j', (text) => {
    expect(detectIntent(text)).toBe('ready');
  });

  it.each([
    'not ready',
    "I'm not ready yet",
    'can we slow down',
    'hold on a second',
    'I want to stay here a bit longer',
    'this is going too fast',
  ])('detects hold for %j', (text) => {
    expect(detectIntent(text)).toBe('hold');
  });

  it.each([
    "I'm ready to quit my job",
    "I can't wait to start my new routine",
    'I feel tired today',
    '',
  ])('does not mistake %j for a pacing request', (text) => {
    expect(detectIntent(text)).toBeNull();
  });

  it('hold wins over ready when both appear', () => {
    expect(detectIntent("I'm ready but not yet")).toBe('hold');
  });
});

describe('invitesAdvice', () => {
  it.each([
    'What should I do?',
    'any ideas?',
    'Should I take the job',
    'can you suggest something',
    "I don't know what to do",
    'Just tell me what to do',
    'give me some options',
  ])('detects an advice request in %j', (text) => {
    expect(invitesAdvice(text)).toBe(true);
  });

  it.each([
    'I feel like I should rest more',
    'I want some quiet time',
    'I think about what I do all day',
    'It started when my manager changed',
  ])('does not flag %j', (text) => {
    expect(invitesAdvice(text)).toBe(false);
  });
});
