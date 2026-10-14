import { LocalModelOption, OperatingMode, PreScanResult, SessionPhase } from './types';
import { preScan } from './safety/guardian';

export const AVAILABLE_MODELS: LocalModelOption[] = [
  {
    id: 'llama-3.2-3b-128k',
    name: 'Llama-3.2-3B-Instruct',
    contextWindow: '128,000 tokens (128k)',
    tag: 'Recommended · Remembers Everything',
    description: 'Like a wise friend who never forgets: Holds onto all your stories, feelings, and small steps safely across every chat.',
    recommended: true,
  },
  {
    id: 'llama-3.2-1b-128k',
    name: 'Llama-3.2-1B-Instruct',
    contextWindow: '128,000 tokens (128k)',
    tag: 'Light & Fast',
    description: 'A quick, gentle companion that uses very little memory on your phone or computer.',
  },
  {
    id: 'phi-3.5-mini-128k',
    name: 'Phi-3.5-mini-instruct',
    contextWindow: '128,000 tokens (128k)',
    tag: 'Deep Thinker',
    description: 'Patiently untangles complicated feelings, puzzles, and big life dilemmas with you.',
  },
  {
    id: 'simulated-airgap',
    name: 'Instant Air-Gapped Simulation',
    contextWindow: 'Unlimited',
    tag: 'Always Ready · Zero Wait',
    description: 'Opens right away with no waiting and no downloading, completely safe and private on your device.',
  },
];

export const CRISIS_RESOURCES = [
  { region: 'United Kingdom', name: 'Samaritans / NHS', number: '116 123 (Samaritans) / 111 (NHS)' },
  { region: 'United States & Canada', name: 'Suicide & Crisis Lifeline', number: '988 (Call or Text)' },
  { region: 'European Union', name: 'Emergency Services', number: '112 (Free 24/7)' },
  { region: 'Crisis Text Line', name: 'Global SMS Support', number: 'Text HOME to 741741' },
  { region: 'Befrienders Worldwide', name: 'International Directory', number: 'befrienders.org' },
];

/**
 * Adapter kept for the existing UI: maps the ported Safety Guardian (`safety/guardian.ts`)
 * onto the v1 `PreScanResult` shape. The detection rules themselves live in the guardian.
 */
export function runPreScan(text: string): PreScanResult {
  const result = preScan(text);

  if (result.tier === 'red') {
    return {
      tier: 'Red',
      matchedCategory: 'Deep Hurt / Safety Check',
      helplineResource: 'Emergency resources activated immediately.',
    };
  }

  if (result.tier === 'amber') {
    return {
      tier: 'Amber',
      matchedCategory: 'Big Overwhelm / Need a Gentle Breath',
    };
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
        reflection: `I hear you, and it makes total sense that you're feeling that way about "${userMessage.slice(0, 50)}..."`,
        inquiry: "What is on your heart the most right now?",
        technique: 'Gentle Listening',
        suggestedNextPhase: 'CheckIn',
        suggestedMode: 'Steady',
      };
    case 'CheckIn':
      return {
        reflection: "Thank you for telling me. It takes real bravery to just be honest about how you're feeling.",
        inquiry: 'How does your body and your energy feel right now, in this quiet moment?',
        technique: 'Checking In On You',
        suggestedNextPhase: 'Focus',
        suggestedMode: 'Explore',
      };
    case 'Focus':
      return {
        reflection: 'That sounds really heavy to carry around all by yourself.',
        inquiry: 'If we could gently look at just one little piece of this together today, which part would you want to hold?',
        technique: 'Finding What Hurts',
        suggestedNextPhase: 'Explore',
        suggestedMode: 'Explore',
      };
    case 'Explore':
      return {
        reflection: 'You have been trying so hard for so long, even when things felt really scary or confusing.',
        inquiry: 'What does the quiet, honest part of you wish could happen?',
        technique: 'Listening to Your Heart',
        suggestedNextPhase: 'Options',
        suggestedMode: 'Build',
      };
    case 'Options':
      return {
        reflection: "Look at that—you're already seeing a few different little ways through this.",
        inquiry: 'Take a look at the little step box below. Which of these gentle ideas feels the safest or easiest for you to try?',
        technique: 'Dreaming of New Paths',
        suggestedNextPhase: 'Commit',
        suggestedMode: 'Perform',
      };
    case 'Commit':
      return {
        reflection: `"${userMessage.length > 50 ? userMessage.slice(0, 50) + '...' : userMessage}" sounds so gentle and caring.`,
        inquiry: 'I have set that as your little step below. Make sure the slider feels like an easy 8, 9, or 10, then tap the green button to finish our chat.',
        technique: 'Taking a Small Step',
        suggestedNextPhase: 'Commit',
        suggestedMode: 'Perform',
      };
    case 'Close':
      return {
        reflection: "You did such sweet, caring work for yourself today. I'm really proud of you for showing up.",
        inquiry: 'What is one kind thing you want to remember and hold onto from our talk today?',
        technique: 'Holding Onto Warmth',
        suggestedNextPhase: 'Close',
        suggestedMode: 'Steady',
      };
  }
}
