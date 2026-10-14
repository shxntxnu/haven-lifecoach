import { describe, expect, it } from 'vitest';
import prescanFixtures from '../../../../resources/safety_fixtures/prescan.json';
import auditFixtures from '../../../../resources/safety_fixtures/audit.json';
import { auditTurn, normalizeText, preScan } from './guardian';
import type { SessionPhase } from '../types';

describe('guardian parity with Rust (shared fixtures)', () => {
  it('loads a non-trivial number of fixtures', () => {
    expect(prescanFixtures.cases.length).toBeGreaterThan(20);
    expect(auditFixtures.cases.length).toBeGreaterThan(8);
  });

  describe('preScan', () => {
    for (const fixture of prescanFixtures.cases) {
      it(`${fixture.id} -> ${fixture.tier}`, () => {
        expect(preScan(fixture.input).tier).toBe(fixture.tier);
      });
    }
  });

  describe('auditTurn', () => {
    for (const fixture of auditFixtures.cases) {
      it(`${fixture.id} -> ${fixture.expect}`, () => {
        const violation = auditTurn(
          fixture.phase as SessionPhase,
          fixture.adviceRequested,
          fixture.payload
        );
        expect(violation?.kind ?? 'ok').toBe(fixture.expect);
      });
    }
  });
});

describe('guardian behaviour', () => {
  it('normalises curly apostrophes', () => {
    expect(normalizeText('I\u2019m here and it\u2018s fine')).toBe("I'm here and it's fine");
  });

  it('red takes priority over amber', () => {
    const result = preScan('I am terrified and I want to kill myself');
    expect(result.tier).toBe('red');
  });

  it('returns matched patterns for red and none for green', () => {
    expect(preScan('I want to die').matchedPatterns.length).toBeGreaterThan(0);
    expect(preScan('I would like to plan my week').matchedPatterns).toEqual([]);
  });

  it('gives corrective detail a model can act on', () => {
    const violation = auditTurn('Explore', false, {
      reflection: 'That sounds hard.',
      fullReply: 'That sounds hard. What happened? How did it feel?',
      reflectionPresent: true,
      adviceGiven: false,
    });
    expect(violation?.kind).toBe('multiple_questions');
    expect(violation?.detail).toContain('2 questions');
  });
});
