/**
 * End-to-end coaching session orchestrator (web counterpart of `crates/haven-infer/src/orchestrator.rs`).
 *
 * Implements the unified 5-tier pipeline:
 *   1. Dual-Tier Pre-Inference Scan (Red intercepts crisis immediately; Amber clamps to Steady)
 *   2. Flow Controller Decision (stay vs advance, reply task, advice gate)
 *   3. Prompt Assembly (slot-based system prompt + rolling history window)
 *   4. Generation (real model or simulation)
 *   5. Safety Guardian Audit with self-healing retry loop (up to 3 attempts, then safe fallback)
 *
 * Guarantees:
 *   - The real model path and simulation path advance phases identically according to readiness.
 *   - No reply reaches the screen without passing the audit.
 *   - Model always sees rolling history so context is never dropped.
 */
import {
  decideTurn,
  type FlowDecision,
  type FlowInput,
  type FlowState,
} from './flow/controller';
import type { PersonIntent } from './flow/signals';
import {
  buildMessages,
  type DialogueTurn,
  type PromptContext,
  type PromptMessage,
} from './prompt/builder';
import {
  auditTurn,
  preScan,
  type AuditViolation,
  type TurnPayload,
} from './safety/guardian';
import { generateSimulatedTurn, type SimulatedTurn } from './simulation/dialogue';
import { CRISIS_RESOURCES } from './engine';

export type BackendGenerator = (
  messages: PromptMessage[],
  onTokenChunk?: (chunk: string) => void
) => Promise<string>;

export interface OrchestratorTurnInput {
  userMessage: string;
  flowState: FlowState;
  history: DialogueTurn[];
  intent?: PersonIntent;
  modelId?: string;
  backend?: BackendGenerator;
  onTokenChunk?: (chunk: string) => void;
  previousStepReview?: string;
}

export interface CrisisResult {
  kind: 'crisis';
  tier: 'red';
  matchedPatterns: string[];
  crisisMessage: string;
  resources: typeof CRISIS_RESOURCES;
}

export interface TurnReplyResult {
  kind: 'reply';
  tier: 'green' | 'amber';
  decision: FlowDecision;
  nextState: FlowState;
  payload: TurnPayload;
  reflection: string;
  inquiry: string;
  fullReply: string;
  technique: string;
  attempts: number;
  fallbackUsed: boolean;
  updatedHistory: DialogueTurn[];
}

export type OrchestratorResult = CrisisResult | TurnReplyResult;

export const MAX_AUDIT_ATTEMPTS = 3;

/**
 * Deterministic safe template used when model generation exhausts retries.
 * Mirrors Rust `CoachingTurnPayload` fallback in `orchestrator.rs`.
 */
export function createSafeFallback(
  decision: FlowDecision,
  _userMessage?: string
): SimulatedTurn {
  const phase = decision.replyPhase;
  let reflection: string;
  let inquiry: string;

  if (phase === 'Commit') {
    reflection =
      'I hear what you shared and want to make sure your step feels gentle and completely doable.';
    inquiry =
      'Take a look at the little step box on your screen below and type your small step there.';
  } else if (phase === 'Close') {
    reflection =
      'I hear what you shared and appreciate you taking this quiet time for yourself today.';
    inquiry = 'What is one gentle thought you want to hold onto as we finish?';
  } else {
    reflection = 'I hear what you shared and want to give you space to explore that.';
    inquiry = 'What feels most important about this for you right now?';
  }

  const fullReply = `${reflection} ${inquiry}`;
  return {
    reflection,
    inquiry,
    fullReply,
    reflectionPresent: true,
    adviceGiven: false,
    technique: 'Gentle Safe Fallback',
  };
}

/**
 * Parses raw text from a model into a `TurnPayload`.
 * Tolerates JSON object format or heuristic paragraph split.
 */
export function parseModelOutput(
  rawText: string
): TurnPayload & { inquiry: string } {
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const reflection = String(parsed.reflection || '').trim();
      const question = String(
        parsed.question ?? parsed.inquiry ?? parsed.response ?? ''
      ).trim();
      const fullReply = parsed.full_reply
        ? String(parsed.full_reply).trim()
        : `${reflection} ${question}`.trim();
      const reflectionPresent = Boolean(
        parsed.reflection_present ?? (reflection.length > 0)
      );
      const adviceGiven = Boolean(parsed.advice_given);

      if (reflection || fullReply) {
        return {
          reflection,
          inquiry: question,
          fullReply: fullReply || rawText.trim(),
          reflectionPresent,
          adviceGiven,
        };
      }
    }
  } catch {
    // Fall back to heuristic parsing if JSON parse fails
  }

  // Heuristic split: first paragraph reflection, second paragraph inquiry
  const paragraphs = rawText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length >= 2) {
    const reflection = paragraphs[0]
      .replace(/^(reflection:?|"|')/i, '')
      .replace(/("|')$/, '')
      .trim();
    const inquiry = paragraphs
      .slice(1)
      .join(' ')
      .replace(/^(inquiry:?|question:?)/i, '')
      .trim();
    return {
      reflection,
      inquiry,
      fullReply: `${reflection} ${inquiry}`.trim(),
      reflectionPresent: reflection.length > 0,
      adviceGiven: false,
    };
  }

  const trimmed = rawText.trim();
  const qMarkIndex = trimmed.indexOf('?');
  if (qMarkIndex !== -1 && qMarkIndex < trimmed.length - 1) {
    const inquiry = trimmed.slice(0, qMarkIndex + 1);
    const reflection = trimmed.slice(qMarkIndex + 1).trim();
    return {
      reflection,
      inquiry,
      fullReply: trimmed,
      reflectionPresent: reflection.length > 0,
      adviceGiven: false,
    };
  }

  return {
    reflection: trimmed.slice(0, Math.min(120, trimmed.length)),
    inquiry:
      trimmed.length > 120
        ? trimmed.slice(120).trim()
        : 'How does this feel as a stepping stone forward?',
    fullReply: trimmed,
    reflectionPresent: trimmed.length > 0,
    adviceGiven: false,
  };
}

/**
 * Executes a turn through the unified 5-tier pipeline.
 */
export async function runTurn(
  input: OrchestratorTurnInput
): Promise<OrchestratorResult> {
  const {
    userMessage,
    flowState,
    history,
    intent,
    modelId,
    backend,
    onTokenChunk,
    previousStepReview,
  } = input;

  // 1. Dual-Tier Pre-Inference Scan
  const preScanResult = preScan(userMessage);

  if (preScanResult.tier === 'red') {
    return {
      kind: 'crisis',
      tier: 'red',
      matchedPatterns: preScanResult.matchedPatterns,
      crisisMessage:
        'It sounds like you are carrying something really painful right now. Your safety and your life matter so much.',
      resources: CRISIS_RESOURCES,
    };
  }

  const riskTier: 'green' | 'amber' = preScanResult.tier === 'amber' ? 'amber' : 'green';

  // 2. Flow Controller Decision
  const flowInput: FlowInput = {
    text: userMessage,
    risk: riskTier,
    intent,
  };
  const decision = decideTurn(flowState, flowInput);

  // 3. Generation & Self-Healing Audit Loop
  const isSimulation = !backend && (!modelId || modelId === 'simulated-airgap');

  let verifiedPayload: (TurnPayload & { inquiry: string; technique?: string }) | null =
    null;
  let attempts = 0;
  let fallbackUsed = false;
  let lastViolation: AuditViolation | null = null;

  if (isSimulation) {
    attempts = 1;
    const sim = generateSimulatedTurn(decision, userMessage, previousStepReview);
    const violation = auditTurn(decision.replyPhase, decision.adviceRequested, sim);
    if (!violation) {
      verifiedPayload = sim;
    } else {
      lastViolation = violation;
    }
  } else if (backend) {
    let promptCtx: PromptContext = {
      phase: decision.replyPhase,
      mode: decision.state.mode,
      replyKind: decision.replyKind,
      adviceUnlocked: decision.adviceUnlocked,
      contract: decision.state.contract,
      focusTopic: decision.state.focusTopic,
      history,
    };

    while (attempts < MAX_AUDIT_ATTEMPTS) {
      attempts++;
      const messages = buildMessages(promptCtx, userMessage);
      const rawOutput = await backend(messages, onTokenChunk);
      const parsed = parseModelOutput(rawOutput);
      const violation = auditTurn(
        decision.replyPhase,
        decision.adviceRequested,
        parsed
      );

      if (!violation) {
        verifiedPayload = parsed;
        break;
      }

      lastViolation = violation;
      promptCtx = {
        ...promptCtx,
        correctiveInstruction: violation.detail,
      };
    }
  }

  let finalPayload: TurnPayload & { inquiry: string; technique?: string };
  if (verifiedPayload) {
    finalPayload = verifiedPayload;
  } else {
    fallbackUsed = true;
    if (lastViolation) {
      console.warn('Inference retries exhausted; violation:', lastViolation.kind);
    }
    finalPayload = createSafeFallback(decision, userMessage);
  }

  const technique =
    finalPayload.technique ??
    (fallbackUsed ? 'Gentle Safe Fallback' : 'Gentle Reflection');

  const updatedHistory: DialogueTurn[] = [
    ...history,
    { speaker: 'person', text: userMessage },
    { speaker: 'haven', text: finalPayload.fullReply },
  ];

  return {
    kind: 'reply',
    tier: riskTier,
    decision,
    nextState: decision.state,
    payload: finalPayload,
    reflection: finalPayload.reflection,
    inquiry: finalPayload.inquiry,
    fullReply: finalPayload.fullReply,
    technique,
    attempts,
    fallbackUsed,
    updatedHistory,
  };
}
