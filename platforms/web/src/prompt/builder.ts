/**
 * Prompt builder (web counterpart of `crates/haven-infer/src/prompt.rs`).
 *
 * Pure functions. The model is only a *slot filler*: this module fixes the shape of the conversation
 * (phase, mode, what this turn must DO) and the model writes the words.
 *
 * Fixes v1 problem 3: v1 sent the model only the latest message. `buildMessages` sends the system
 * prompt, a rolling window of the real conversation, and then the new message.
 */
import type { ReplyKind } from '../flow/controller';
import type { OperatingMode, SessionPhase } from '../types';

export interface DialogueTurn {
  speaker: 'person' | 'haven';
  text: string;
}

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptContext {
  phase: SessionPhase;
  mode: OperatingMode;
  /** What this turn must do. Comes from the flow controller. */
  replyKind: ReplyKind;
  /** Advice may be offered this turn (Options phase and the person invited it). */
  adviceUnlocked: boolean;
  contract?: string;
  focusTopic?: string;
  /** Earlier turns, oldest first. Must NOT include the message being answered. */
  history: DialogueTurn[];
  /** Set on a retry after the guardian rejected the previous draft. */
  correctiveInstruction?: string;
}

export const HISTORY_MAX_TURNS = 16;
export const HISTORY_MAX_CHARS = 8000;
/** Below this many characters a truncated turn is just noise, so we drop it instead. */
const MIN_USEFUL_FRAGMENT = 20;

const PERSONA = [
  'You are Haven, a kind, gentle companion and personal development thinking partner.',
  'You speak in simple, warm, everyday words that feel safe to someone\'s inner child.',
  'You never use corporate jargon, big fancy words, or therapy speak.',
  'You are NOT a therapist and you NEVER diagnose anything.',
  'You follow International Coaching Federation (ICF) and Motivational Interviewing standards.',
].join('\n');

/** The opening intent of each phase, used when a phase has just started. */
const PHASE_INTENT: Record<SessionPhase, string> = {
  Contract: 'Gently help them say what would make this time feel worth it.',
  CheckIn: 'Ask how they are feeling in their body and their mind right now.',
  Focus: 'Help them choose the one thing that matters most right now. Never choose the topic for them.',
  Explore: 'Help them look closely at what is happening and what matters to them. Do not try to fix anything.',
  Options: 'Help them notice what might be possible. Let them be the one to pick.',
  Commit: 'Point them to the little step box on the screen and help them make their step tiny and easy.',
  Close: 'Wrap up warmly and thank them for being here.',
};

/** What this turn must do, by reply kind. Exhaustive: adding a ReplyKind forces an entry here. */
const TURN_TASK: Record<ReplyKind, (phase: SessionPhase) => string> = {
  ask: (phase) => `You have just moved to a new part of the conversation. ${PHASE_INTENT[phase]}`,
  deepen: () =>
    'They shared something real. Reflect it back, then ask ONE gentle question that goes a little deeper.',
  reask: () =>
    'They shared very little, and that is okay. Reflect warmly, then ask the question again in a softer, easier way.',
  rephrase: () =>
    'They seem stuck. Offer a simpler way in, such as two easy choices to pick between, and ask ONE question.',
  'offer-pause': () =>
    'Tell them it is okay to rest and come back any time. Do not ask anything hard.',
  'honor-hold': () =>
    'They asked to slow down. Thank them, say there is no rush at all, and ask what would help them feel ready.',
  'invite-share': () =>
    'They said they are ready, but they have not shared anything yet. Warmly invite them to share what is on their mind first.',
  'decline-advice': () =>
    'They asked what to do. Kindly say you will not tell them what to do because they know themselves best, say ideas can come a little later if they want, and ask ONE question about what matters to them.',
  'offer-options': () =>
    'They asked for ideas. Offer 2 or 3 small, different ideas, then ask which one feels right.',
  ground: () =>
    'They are having a hard time. Be extra gentle and brief. Help them feel steady, for example with one slow breath. Do not plan or push.',
  'guide-card': () =>
    'Point them to the little step box on the screen and tell them what to do next.',
  closing: () => 'Close warmly. Thank them and tell them to be gentle with themselves.',
  closed: () => 'The chat is finished. Close warmly.',
};

/** Keeps the most recent turns within a turn and character budget, dropping the oldest first. */
export function windowHistory(
  history: DialogueTurn[],
  maxTurns: number = HISTORY_MAX_TURNS,
  maxChars: number = HISTORY_MAX_CHARS
): DialogueTurn[] {
  const recent = history.slice(-maxTurns);
  const kept: DialogueTurn[] = [];
  let used = 0;

  for (let i = recent.length - 1; i >= 0; i--) {
    const turn = recent[i];
    const remaining = maxChars - used;
    if (remaining < MIN_USEFUL_FRAGMENT) break;

    if (turn.text.length <= remaining) {
      kept.unshift(turn);
      used += turn.text.length;
    } else {
      // Keep the END of the oldest turn that still fits: recent words matter most.
      kept.unshift({ ...turn, text: `\u2026${turn.text.slice(turn.text.length - remaining + 1)}` });
      break;
    }
  }
  return kept;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const lines: string[] = [PERSONA, ''];

  lines.push(`CURRENT PHASE: ${ctx.phase}`);
  lines.push(`ACTIVE MODE: ${ctx.mode}`);
  lines.push(`SESSION CONTRACT: ${ctx.contract ?? 'None established yet'}`);
  if (ctx.focusTopic) lines.push(`WHAT MATTERS MOST TO THEM: ${ctx.focusTopic}`);

  lines.push('', `YOUR TASK THIS TURN: ${TURN_TASK[ctx.replyKind](ctx.phase)}`, '');

  lines.push('STRICT RULES:');
  lines.push(
    '1. Start with a warm, non-judgmental, SPECIFIC REFLECTION of what they felt or said. Never use generic filler like "I hear you and that makes sense". Attune directly to the specific emotional weight or situation they described.'
  );
  lines.push("2. Ask at most ONE open question (prefer 'what' or 'how'; avoid 'why').");
  if (ctx.phase === 'Options' && ctx.adviceUnlocked) {
    lines.push('3. ADVICE IS ALLOWED THIS TURN because they invited ideas. Offer 2 or 3 brief options and ask which feels right.');
  } else {
    lines.push('3. DO NOT give advice, solutions, or suggestions. Help them find their own way.');
  }
  lines.push('4. Never pressure them to act. Any step must come from them.');
  lines.push(
    '5. End with exactly ONE question, or ONE clear instruction about what to do next on the screen. They must never be left unsure what to do.'
  );
  if (ctx.mode === 'Steady') {
    lines.push('6. Keep your whole reply under 3 sentences, calm and grounding.');
  }

  if (ctx.correctiveInstruction) {
    lines.push(
      '',
      'CORRECTION: your last reply was rejected.',
      ctx.correctiveInstruction,
      'Fix this in your new reply.'
    );
  }

  lines.push(
    '',
    'Reply ONLY with a JSON object in exactly this shape:',
    '{"reflection": "...", "question": "... or null", "full_reply": "reflection and question together", "reflection_present": true, "advice_given": false, "risk_tier": "green"}'
  );

  return lines.join('\n');
}

/**
 * Full chat for the model: system prompt, a rolling window of the conversation so far, then the
 * message being answered. Consecutive turns by the same speaker are merged so roles always alternate.
 */
export function buildMessages(ctx: PromptContext, userMessage: string): PromptMessage[] {
  const messages: PromptMessage[] = [{ role: 'system', content: buildSystemPrompt(ctx) }];

  // Tolerate callers that already appended the current message to the history.
  let history = ctx.history;
  const last = history[history.length - 1];
  if (last && last.speaker === 'person' && last.text === userMessage) {
    history = history.slice(0, -1);
  }

  const turns: DialogueTurn[] = [...windowHistory(history), { speaker: 'person', text: userMessage }];

  for (const turn of turns) {
    const role: PromptMessage['role'] = turn.speaker === 'person' ? 'user' : 'assistant';
    const previous = messages[messages.length - 1];
    if (previous.role === role) {
      previous.content = `${previous.content}\n${turn.text}`;
    } else {
      messages.push({ role, content: turn.text });
    }
  }

  return messages;
}
