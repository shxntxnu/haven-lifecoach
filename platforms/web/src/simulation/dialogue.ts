/**
 * Simulated dialogue engine (replaces static strings in `engine.ts`).
 *
 * Pure functions: maps a `FlowDecision` and the user's message to an audited `TurnPayload`.
 * Every template strictly satisfies the Safety Guardian:
 *   - Reflection present and warm.
 *   - At most one open question or one clear instruction.
 *   - Advice only on `offer-options` (Options phase with invitation).
 *   - Zero clinical or dependency-forming language.
 */
import type { FlowDecision } from '../flow/controller';
import type { TurnPayload } from '../safety/guardian';

export interface SimulatedTurn extends TurnPayload {
  inquiry: string;
  technique: string;
}

function truncate(text: string, maxLen: number): string {
  const clean = text.trim().replace(/["']/g, '');
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
}

function extractAttunedReflection(userMessage: string, fallback?: string): string {
  const text = userMessage.toLowerCase();

  if (/\b(?:tired|exhausted|burn(?:ed)?\s*out|drained|overwhelm(?:ed)?|too\s+much|heavy|can't\s+keep\s+up|swamped)\b/.test(text)) {
    return 'I can hear how much energy this has been taking out of you, and how deeply tired you feel carrying so much on your shoulders.';
  }
  if (/\b(?:anxious|scared|worry|worried|fear|racing|nervous|panic|uneasy|dread)\b/.test(text)) {
    return 'It sounds like your mind has been spinning without giving you a chance to catch your breath, and that can feel so exhausting.';
  }
  if (/\b(?:sad|crying|lonely|alone|lost|grief|hurt|heartbroken|empty)\b/.test(text)) {
    return 'I can feel how much sadness is resting with you right now, and how heavy that feels to sit with.';
  }
  if (/\b(?:angry|mad|annoyed|frustrated|fight|argument|conflict|unfair|furious)\b/.test(text)) {
    return 'It makes complete sense that you would feel frustrated and upset after dealing with that kind of tension.';
  }
  if (/\b(?:failure|guilt|guilty|messed\s+up|my\s+fault|hate\s+myself|not\s+good\s+enough|lazy)\b/.test(text)) {
    return 'You are putting so much pressure on yourself right now, even though you have been trying your hardest through some really difficult days.';
  }
  if (/\b(?:work|job|boss|manager|deadline|career|colleague|project)\b/.test(text)) {
    return 'Work demands can feel so relentless, and it sounds like this situation has been weighing on your mind a lot.';
  }
  if (/\b(?:peace|calm|quiet|rest|break|space|breathe|relief|relax)\b/.test(text)) {
    return 'I hear how deeply you are craving some quiet breathing room and gentle relief right now.';
  }

  if (fallback) {
    return fallback;
  }

  const clean = truncate(userMessage, 45);
  if (clean.length > 0) {
    return `Hearing you describe ${clean.toLowerCase()} really highlights how much this has been on your mind.`;
  }

  return 'Thank you for sharing that with me. It takes real honesty to put feelings into words.';
}

export function generateSimulatedTurn(
  decision: FlowDecision,
  userMessage: string,
  previousStepReview?: string
): SimulatedTurn {
  const { replyPhase, replyKind, state } = decision;

  let reflection: string;
  let inquiry: string;
  let technique: string;
  let adviceGiven = false;

  switch (replyKind) {
    case 'ask': {
      switch (replyPhase) {
        case 'Contract':
          reflection =
            userMessage.trim().length > 0
              ? extractAttunedReflection(userMessage, `I hear how much "${truncate(userMessage, 40)}" has been occupying your mind.`)
              : "Welcome. I'm really glad you're here today.";
          inquiry = previousStepReview
            ? `By the way, were you able to try the little step you set for yourself last time: "${truncate(previousStepReview, 45)}"?`
            : "What would make this quiet time feel most worth it for you?";
          technique = 'Gentle Listening';
          break;
        case 'CheckIn':
          reflection = `Thank you for sharing that with me. I hear what you are hoping for with "${truncate(
            state.contract || userMessage,
            40
          )}".`;
          inquiry = previousStepReview
            ? `By the way, were you able to try the little step you set for yourself last time: "${truncate(previousStepReview, 45)}"?`
            : 'How does your body and your mind feel right now, in this quiet moment?';
          technique = 'Checking In On You';
          break;
        case 'Focus':
          reflection = extractAttunedReflection(userMessage, 'Thank you for being so honest about how you are feeling right now.');
          inquiry =
            'If we could gently look at just one little piece of this together today, what matters most to you?';
          technique = 'Finding What Matters';
          break;
        case 'Explore':
          reflection = `That makes so much sense why "${truncate(
            state.focusTopic || userMessage,
            40
          )}" is the thing on your mind.`;
          inquiry = 'What does this feel like when you are right in the middle of it?';
          technique = 'Exploring What Hurts';
          break;
        case 'Options':
          reflection = 'You have looked at this so honestly and with so much courage.';
          inquiry = 'What is one gentle possibility that comes to mind, even a tiny one?';
          technique = 'Exploring Possibilities';
          break;
        case 'Commit':
          reflection =
            'Look at that—you have reached a place where a small, gentle path is beginning to form.';
          inquiry =
            'Take a look at the little step box on your screen below and type your small step there.';
          technique = 'Taking a Small Step';
          break;
        case 'Close':
          reflection =
            'You did such sweet, caring work for yourself today. I am really proud of you for showing up.';
          inquiry = 'What is one kind thought you want to hold onto from our talk today?';
          technique = 'Holding Onto Warmth';
          break;
      }
      break;
    }

    case 'deepen': {
      switch (replyPhase) {
        case 'Contract':
          reflection = extractAttunedReflection(
            userMessage,
            `I hear how much "${truncate(userMessage, 40)}" has been on your mind.`
          );
          inquiry = 'What would help you feel safe and comfortable as we talk through this today?';
          technique = 'Setting Our Space';
          break;
        case 'CheckIn':
          reflection = extractAttunedReflection(
            userMessage,
            `It takes real bravery to talk honestly about "${truncate(userMessage, 40)}".`
          );
          inquiry = 'When that feeling is there, what does your body need most right now?';
          technique = 'Listening to Your Body';
          break;
        case 'Focus':
          reflection = extractAttunedReflection(
            userMessage,
            `I can feel how much "${truncate(userMessage, 40)}" has been taking up space in your thoughts.`
          );
          inquiry = 'What makes that feel like the most important part to focus on right now?';
          technique = 'Clarifying Focus';
          break;
        case 'Explore':
          reflection = extractAttunedReflection(
            userMessage,
            `You have been carrying "${truncate(
              userMessage,
              40
            )}" for a while, and it makes total sense that it feels heavy.`
          );
          inquiry = 'What quiet part of you wishes things could feel a little different?';
          technique = 'Gentle Deepening';
          break;
        case 'Options':
          reflection = `"${truncate(userMessage, 40)}" is a really thoughtful idea.`;
          inquiry = 'What else might be a tiny option, or does that one feel like the right place to begin?';
          technique = 'Gathering Ideas';
          break;
        case 'Commit':
          reflection = `"${truncate(userMessage, 40)}" sounds like such a gentle step.`;
          inquiry = 'How can we make this step so small that it feels completely effortless for you?';
          technique = 'Shrinking the Step';
          break;
        case 'Close':
          reflection = `Holding onto "${truncate(userMessage, 40)}" is such a sweet gift to yourself.`;
          inquiry = 'How does your mind and your body feel right now as we get ready to wrap up?';
          technique = 'Closing Reflections';
          break;
      }
      break;
    }

    case 'reask':
      reflection = 'Take all the time you need, there is no hurry here at all.';
      inquiry = 'Would you like to share just a few words about what is on your mind?';
      technique = 'Gentle Patience';
      break;

    case 'rephrase':
      reflection = 'Sometimes it is hard to find the right words, and that is completely okay.';
      inquiry =
        'Would it feel easier to talk about how you are feeling in your body right now, or what happened today?';
      technique = 'Gentle Choices';
      break;

    case 'offer-pause':
      reflection =
        'It is completely okay if right now is not the right time to talk. You can rest, take a gentle breath, and come back whenever you are ready.';
      inquiry = 'Would you like to take a little pause and rest for now?';
      technique = 'Honoring Rest';
      break;

    case 'honor-hold':
      reflection = 'There is no rush at all—we will stay right here for as long as you need.';
      inquiry = 'What would help you feel a little more comfortable right now?';
      technique = 'Honoring Your Pace';
      break;

    case 'invite-share':
      reflection = 'I am so glad you are here and ready to share.';
      inquiry = 'Whenever you feel comfortable, what would you like to talk about today?';
      technique = 'Gentle Invitation';
      break;

    case 'decline-advice':
      reflection =
        'I hear that you are looking for guidance, and it makes total sense to want answers when things feel hard. Because you know your life best, I will not tell you what to do, but we will look at gentle ideas together when we get to options.';
      inquiry = 'What feels most important to you about this right now?';
      technique = 'Autonomy Support';
      break;

    case 'offer-options':
      reflection =
        'I hear you asking for ideas, and here are two gentle thoughts you could consider: you could take a five-minute quiet breather, or jot down one thought on paper.';
      inquiry = 'Which of those feels more appealing to you, or does a different idea come to mind?';
      technique = 'Offering Possibilities';
      adviceGiven = true;
      break;

    case 'ground':
      reflection =
        'I hear how heavy and overwhelming everything feels right now. Let us take one slow, gentle breath together and rest for a moment.';
      inquiry = 'How does your body feel right in this quiet second?';
      technique = 'Gentle Steadying';
      break;

    case 'guide-card':
      reflection =
        'You have a gentle path forming, and you have done so much good thinking.';
      inquiry =
        'Take a look at the little step box on your screen below—type your small step there and choose how confident you feel.';
      technique = 'Taking a Small Step';
      break;

    case 'closing':
      reflection =
        'You did such brave, caring work for yourself today. Thank you for sharing your time with me, and please remember to be gentle with yourself.';
      inquiry = 'How does your mind feel as you step back into your day?';
      technique = 'Warm Wrap-Up';
      break;

    case 'closed':
      reflection = 'Our chat for today is finished. You are safe, and you did wonderfully.';
      inquiry = 'Please remember to be kind to yourself today.';
      technique = 'Session Closed';
      break;
  }

  const fullReply = `${reflection} ${inquiry}`.trim();

  return {
    reflection,
    inquiry,
    fullReply,
    reflectionPresent: true,
    adviceGiven,
    technique,
  };
}
