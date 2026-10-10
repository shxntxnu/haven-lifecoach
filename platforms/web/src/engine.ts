import { LocalModelOption, OperatingMode, PreScanResult, SessionPhase } from './types';

export const AVAILABLE_MODELS: LocalModelOption[] = [
  {
    id: 'llama-3.2-3b-128k',
    name: 'Llama-3.2-3B-Instruct',
    contextWindow: '128,000 tokens (128k)',
    tag: 'Recommended · Zero Context Loss',
    description: 'Optimal local model for Haven: 128k context preserves all multi-session agendas, commitments, and behavioral history without truncation.',
    recommended: true,
  },
  {
    id: 'llama-3.2-1b-128k',
    name: 'Llama-3.2-1B-Instruct',
    contextWindow: '128,000 tokens (128k)',
    tag: 'Ultra-Lightweight · Low RAM',
    description: 'Lightweight ~800MB 4-bit model with full 128k context window. Ideal for low-memory laptops and smartphones.',
  },
  {
    id: 'phi-3.5-mini-128k',
    name: 'Phi-3.5-mini-instruct',
    contextWindow: '128,000 tokens (128k)',
    tag: 'High Reasoning · 3.8B',
    description: 'Long-context reasoning specialist with 128k context support for complex strategic goals and multi-faceted career challenges.',
  },
  {
    id: 'simulated-airgap',
    name: 'Instant Air-Gapped Simulation',
    contextWindow: 'Unlimited',
    tag: 'Zero Download · Instant',
    description: 'Deterministic Rust/WASM rule engine running completely offline on your device with 0 network calls and instant zero-latency responses.',
  },
];

export const CRISIS_RESOURCES = [
  { region: 'United Kingdom', name: 'Samaritans / NHS', number: '116 123 (Samaritans) / 111 (NHS)' },
  { region: 'United States & Canada', name: 'Suicide & Crisis Lifeline', number: '988 (Call or Text)' },
  { region: 'European Union', name: 'Emergency Services', number: '112 (Free 24/7)' },
  { region: 'Crisis Text Line', name: 'Global SMS Support', number: 'Text HOME to 741741' },
  { region: 'Befrienders Worldwide', name: 'International Directory', number: 'befrienders.org' },
];

export function runPreScan(text: string): PreScanResult {
  const lower = text.toLowerCase();
  
  const redPhrases = [
    'kill myself',
    'suicide',
    'end my life',
    'want to die',
    'better off dead',
    'self-harm',
    'cut myself',
    'overdose',
    'slit my wrists',
    'no reason to live'
  ];

  for (const phrase of redPhrases) {
    if (lower.includes(phrase)) {
      return {
        tier: 'Red',
        matchedCategory: 'Acute Crisis / Self-Harm Risk',
        helplineResource: 'Emergency resources activated immediately.',
      };
    }
  }

  const amberPhrases = [
    'panic attack',
    'cant breathe',
    "can't breathe",
    'hyperventilating',
    'shaking uncontrollably',
    'crying uncontrollably',
    'extreme distress',
    'terrified'
  ];

  for (const phrase of amberPhrases) {
    if (lower.includes(phrase)) {
      return {
        tier: 'Amber',
        matchedCategory: 'Acute Emotional Distress',
      };
    }
  }

  return { tier: 'Green' };
}

export interface CoachResponse {
  reflection: string;
  inquiry: string;
  technique: string;
  suggestedNextPhase?: SessionPhase;
  suggestedMode?: OperatingMode;
}

export function generateCoachResponse(
  currentPhase: SessionPhase,
  userMessage: string,
  _mode: OperatingMode
): CoachResponse {
  switch (currentPhase) {
    case 'Contract':
      return {
        reflection: `I hear your desire to explore "${userMessage.slice(0, 60)}..." and I want to honour that intention today.`,
        inquiry: 'What would make our time together today genuinely meaningful and valuable for you?',
        technique: 'Goal Clarification (GROW)',
        suggestedNextPhase: 'CheckIn',
        suggestedMode: 'Steady',
      };
    case 'CheckIn':
      return {
        reflection: 'Thank you for sharing your current state openly and grounding us here.',
        inquiry: 'How is your energy right now as we step into this conversation?',
        technique: 'Open Reflection (OARS)',
        suggestedNextPhase: 'Focus',
        suggestedMode: 'Explore',
      };
    case 'Focus':
      return {
        reflection: 'It sounds like this focal point holds significant weight and opportunity for your growth.',
        inquiry: 'If we could leave today with complete clarity on one specific aspect, what would that be?',
        technique: 'Values-Anchored Inversion',
        suggestedNextPhase: 'Explore',
        suggestedMode: 'Explore',
      };
    case 'Explore':
      return {
        reflection: 'You are noticing the deeper beliefs and tensions that shape how you approach this challenge.',
        inquiry: 'What assumptions might you be holding about what is possible here?',
        technique: 'Socratic Inquiry',
        suggestedNextPhase: 'Options',
        suggestedMode: 'Build',
      };
    case 'Options':
      return {
        reflection: 'You are beginning to see several distinct pathways forward from this new vantage point.',
        inquiry: 'Which of these possibilities sparks the greatest curiosity or traction for you?',
        technique: 'Creative Brainstorming',
        suggestedNextPhase: 'Commit',
        suggestedMode: 'Perform',
      };
    case 'Commit':
      return {
        reflection: 'You are translating this fresh awareness into a concrete, self-authored commitment.',
        inquiry: 'On a scale from 0 to 10, how confident do you feel that you will follow through with this step before our next conversation?',
        technique: 'Readiness Ruler (MI)',
        suggestedNextPhase: 'Commit',
        suggestedMode: 'Perform',
      };
    case 'Close':
      return {
        reflection: 'You have done dedicated, courageous inner work throughout this entire conversation.',
        inquiry: 'What is the key takeaway or insight you want to carry forward into your week?',
        technique: 'Appreciative Inquiry',
        suggestedNextPhase: 'Close',
        suggestedMode: 'Steady',
      };
  }
}
