/**
 * Safety Guardian (web port of `crates/haven-core/src/guardian.rs`).
 *
 * Pure functions only: no React, no I/O. Behaviour is pinned to the Rust implementation by the
 * SHARED fixtures in `resources/safety_fixtures/`, which both test suites run. If you change a
 * pattern here, change it in `guardian.rs` too, or one of the two suites will fail.
 */
import type { SessionPhase } from '../types';

export type RiskTier = 'green' | 'amber' | 'red';

export interface PreScanResult {
  tier: RiskTier;
  matchedPatterns: string[];
}

export type AuditViolationKind =
  | 'missing_reflection'
  | 'multiple_questions'
  | 'unsolicited_advice'
  | 'diagnostic_language'
  | 'dependency_language';

export interface AuditViolation {
  kind: AuditViolationKind;
  /** Human-readable detail, safe to feed back to a model as corrective guidance. */
  detail: string;
}

export interface TurnPayload {
  reflection: string;
  fullReply: string;
  reflectionPresent: boolean;
  adviceGiven: boolean;
}

/**
 * Normalises typographic apostrophes to ASCII `'`.
 * Phone keyboards emit curly apostrophes, which would otherwise evade patterns like `can't go on`.
 */
export function normalizeText(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'");
}

// Red tier: active suicidal ideation, self-harm, physical violence, overdose.
// NOTE: ambiguous phrases ("take my life back", "cut myself some slack") are deliberately NOT matched.
const RED_PATTERNS: RegExp[] = [
  /\b(?:kill|end|take)\s+(?:my\s+own\s+life|myself)\b/i,
  /\bcommit\s+suicide\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\b(?:hang|shoot|slit|poison)\s+myself\b/i,
  /\boverdose\s+on\b/i,
  /\bcutting\s+myself\b/i,
  /\bcut\s+my\s+wrists\b/i,
  /\b(?:jumping|jump)\s+off\s+a\s+(?:bridge|building|roof)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\b(?:he|she|partner|husband|wife)\s+is\s+(?:beating|hitting|choking|attacking)\s+me\b/i,
  /\bthreatened\s+to\s+kill\s+me\b/i,
  /\bin\s+immediate\s+danger\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[\s-]?harm(?:ing)?\b/i,
  /\bend\s+my\s+(?:own\s+)?life\b/i,
  /\bover-?dos(?:e|ed|ing)\b/i,
  /\b(?:slit|slash)\s+my\s+wrists\b/i,
  /\bcut\s+myself\s+(?:again|on\s+purpose|open|deep)\b/i,
];

// Amber tier: severe hopelessness, panic, persistent exhaustion.
const AMBER_PATTERNS: RegExp[] = [
  /\bcan't\s+go\s+on\s+like\s+this\b/i,
  /\bcompletely\s+hopeless\b/i,
  /\beverything\s+is\s+falling\s+apart\b/i,
  /\bsevere\s+panic\s+attack\b/i,
  /\bcan't\s+breathe\s+from\s+panic\b/i,
  /\bcrying\s+uncontrollably\b/i,
  /\bdeep\s+dark\s+hole\b/i,
  /\bexhausted\s+of\s+everything\b/i,
  /\bcannot\s+get\s+out\s+of\s+bed\b/i,
  /\bnothing\s+matters\s+anymore\b/i,
  /\bpanic\s+attack\b/i,
  /\bcan'?t\s+breathe\b/i,
  /\bhyperventilat(?:e|ing)\b/i,
  /\bshaking\s+uncontrollably\b/i,
  /\bextreme\s+distress\b/i,
  /\bterrified\b/i,
];

const CLINICAL_PATTERNS: RegExp[] = [
  /\byou\s+(?:have|suffer\s+from|are\s+diagnosed\s+with)\s+(?:clinical\s+depression|depression|bipolar|schizophrenia|bpd|borderline\s+personality\s+disorder|personality\s+disorder|ptsd|ocd|adhd|anxiety\s+disorder|eating\s+disorder|psychosis)\b/i,
  /\byou\s+are\s+diagnosed\s+with\b/i,
  /\bmy\s+diagnosis\s+is\b/i,
  /\bas\s+your\s+therapist\b/i,
  /\bpsychiatric\s+assessment\b/i,
  /\bclinical\s+assessment\b/i,
];

const DEPENDENCY_PATTERNS: RegExp[] = [
  /\bi('m|\s+am)\s+the\s+only\s+(?:one\s+who\s+understands|person\s+who\s+cares)\b/i,
  /\byou\s+(?:only\s+need|don't\s+need\s+anyone\s+other\s+than)\s+me\b/i,
  /\bi\s+missed\s+you\b/i,
  /\bi\s+will\s+always\s+be\s+here\s+for\s+you\s+forever\b/i,
];

const ADVICE_PRESCRIPTIVE_PATTERNS: RegExp[] = [
  /\byou\s+(?:should|must|ought\s+to|need\s+to)\s+[a-z]+/i,
  /\bmy\s+advice\s+is\s+to\b/i,
  /\bhere\s+is\s+what\s+you\s+must\s+do\b/i,
  /\bwhat\s+you\s+need\s+to\s+do\s+is\b/i,
];

function matchingPatterns(patterns: RegExp[], text: string): string[] {
  return patterns.filter((p) => p.test(text)).map((p) => p.source);
}

/**
 * Pre-inference scan. Runs on raw user input BEFORE any model is called.
 * Red always wins over amber.
 */
export function preScan(userInput: string): PreScanResult {
  const text = normalizeText(userInput);

  const red = matchingPatterns(RED_PATTERNS, text);
  if (red.length > 0) {
    return { tier: 'red', matchedPatterns: red };
  }

  const amber = matchingPatterns(AMBER_PATTERNS, text);
  if (amber.length > 0) {
    return { tier: 'amber', matchedPatterns: amber };
  }

  return { tier: 'green', matchedPatterns: [] };
}

function firstMatch(patterns: RegExp[], text: string): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

/**
 * Post-inference audit. Returns the first violation found, or `null` when the turn is compliant.
 * Check order mirrors the Rust implementation exactly.
 */
export function auditTurn(
  phase: SessionPhase,
  adviceRequested: boolean,
  payload: TurnPayload
): AuditViolation | null {
  // 1. Reflection is mandatory.
  if (!payload.reflectionPresent || payload.reflection.trim() === '') {
    return {
      kind: 'missing_reflection',
      detail: 'Start by reflecting back what the person felt before asking anything.',
    };
  }

  const reply = normalizeText(payload.fullReply);

  // 2. At most one question.
  const questionCount = (reply.match(/\?/g) ?? []).length;
  if (questionCount > 1) {
    return {
      kind: 'multiple_questions',
      detail: `Your reply contained ${questionCount} questions. Ask exactly one.`,
    };
  }

  // 3. Advice gate.
  if (phase !== 'Options') {
    if (payload.adviceGiven) {
      return {
        kind: 'unsolicited_advice',
        detail: `Do not give advice in the ${phase} phase. Reflect and ask one gentle question instead.`,
      };
    }
    if (ADVICE_PRESCRIPTIVE_PATTERNS.some((p) => p.test(reply))) {
      return {
        kind: 'unsolicited_advice',
        detail: `Prescriptive wording is not allowed in the ${phase} phase. Do not tell the person what to do.`,
      };
    }
  } else if (!adviceRequested && payload.adviceGiven) {
    return {
      kind: 'unsolicited_advice',
      detail: 'The person has not asked for ideas. Do not offer any unless they invite them.',
    };
  }

  // 4. Clinical diagnosis scrubbing.
  const clinical = firstMatch(CLINICAL_PATTERNS, reply);
  if (clinical !== null) {
    return {
      kind: 'diagnostic_language',
      detail: `Do not use clinical or diagnostic wording ("${clinical}"). You are a companion, not a clinician.`,
    };
  }

  // 5. Dependency-forming / parasocial scrubbing.
  const dependency = firstMatch(DEPENDENCY_PATTERNS, reply);
  if (dependency !== null) {
    return {
      kind: 'dependency_language',
      detail: `Do not use dependency-forming wording ("${dependency}"). Encourage the person's other support too.`,
    };
  }

  return null;
}
