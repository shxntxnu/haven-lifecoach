/**
 * Language signals used by the flow controller.
 *
 * Pure, dependency-light helpers that read ONE message and say something simple about it.
 * They never decide what the conversation does next: that is the controller's job.
 */
import { normalizeText } from '../safety/guardian';

/** What the person explicitly wants about pacing, if anything. */
export type PersonIntent = 'ready' | 'hold' | null;

/** Counts words, treating apostrophes as part of a word ("don't" is one word). */
export function countWords(text: string): number {
  const matches = normalizeText(text).match(/[\p{L}\p{N}']+/gu);
  return matches ? matches.length : 0;
}

const NON_ANSWER =
  /^(?:i\s+)?(?:don't|do\s+not|dont)\s+know\b|\bnot\s+sure\b|\bno\s+idea\b|\bidk\b|\bdunno\b|^(?:nothing|nope|no|yes|yeah|ok|okay|fine|maybe)\W*$/i;

/**
 * True for empty or very short "I don't know"-style replies.
 * Longer messages that merely contain "not sure" are real answers and are NOT non-answers.
 */
export function isNonAnswer(text: string): boolean {
  const normalized = normalizeText(text).trim();
  if (normalized === '') return true;
  return countWords(normalized) <= 6 && NON_ANSWER.test(normalized);
}

// A "ready" message must be the WHOLE message, so "I'm ready to quit my job" is content, not pacing.
const READY_WHOLE_MESSAGE =
  /^(?:(?:yes|yeah|yep|ok|okay)[,.!\s]+)?(?:(?:i'?m|i\s+am)\s+)?ready(?:\s+(?:to\s+)?(?:move\s+on|continue|go\s+on|go\s+ahead|keep\s+going|for\s+the\s+next\s+(?:part|step)))?[.!\s]*$|^(?:next|continue|move\s+on|let'?s\s+move\s+on|keep\s+going|go\s+on|let'?s\s+continue)[.!\s]*$/i;

// "Hold" is matched anywhere: when in doubt, slowing down is the safe direction.
const HOLD =
  /\b(?:not\s+ready|not\s+yet|hold\s+on|wait\s+(?:a\s+)?(?:bit|moment|minute|second)|stay\s+here|a\s+(?:bit|little)\s+longer|slow\s+down|too\s+fast)\b/i;

/** Detects an explicit pacing wish typed in plain words. Hold wins over ready. */
export function detectIntent(text: string): PersonIntent {
  const normalized = normalizeText(text).trim();
  if (HOLD.test(normalized)) return 'hold';
  if (READY_WHOLE_MESSAGE.test(normalized)) return 'ready';
  return null;
}

const ADVICE_ASKS: RegExp[] = [
  /\bwhat\s+(?:should|do)\s+i\s+do\b/i,
  /\bwhat\s+would\s+you\s+(?:do|suggest|recommend)\b/i,
  /\bwhat\s+do\s+you\s+(?:suggest|recommend|think\s+i\s+should)\b/i,
  /\b(?:any|some)\s+(?:ideas|suggestions|options|advice)\b/i,
  /\b(?:can|could)\s+you\s+(?:suggest|recommend|give\s+me|tell\s+me\s+what)\b/i,
  /\bgive\s+me\s+(?:some\s+)?(?:ideas|options|suggestions|advice)\b/i,
  /\btell\s+me\s+what\s+to\s+do\b/i,
  /\bhelp\s+me\s+(?:think\s+of|come\s+up\s+with|find)\b/i,
  /\bi\s+(?:don't|do\s+not)\s+know\s+what\s+to\s+do\b/i,
  /\bshould\s+i\b/i,
];

/** True when the person is asking Haven for advice, ideas, or a decision. */
export function invitesAdvice(text: string): boolean {
  const normalized = normalizeText(text);
  return ADVICE_ASKS.some((pattern) => pattern.test(normalized));
}
