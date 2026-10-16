/**
 * Simulated dialogue engine (replaces static strings in `engine.ts`).
 *
 * Pure functions: maps a `FlowDecision` and the user's message to an audited `TurnPayload`.
 * Every template strictly satisfies the Safety Guardian:
 *   - Reflection present and warm.
 *   - At most one open question or one clear instruction.
 *   - Advice only on `offer-options` (Options phase with invitation).
 *   - Zero clinical or dependency-forming language.
 *   - Full contextual awareness across positive, reflective, and vulnerable tones.
 */
import type { FlowDecision } from '../flow/controller';
import type { TurnPayload } from '../safety/guardian';

export interface SimulatedTurn extends TurnPayload {
  inquiry: string;
  technique: string;
}

export type MessageTone = 'positive' | 'vulnerable' | 'reflective';

function truncate(text: string, maxLen: number): string {
  const clean = text.trim().replace(/["']/g, '');
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
}

/**
 * Classifies emotional tone and valence so Haven meets the person where they are,
 * avoiding negative assumptions when they are celebrating, inspired, or practical.
 */
export function classifyTone(userMessage: string): MessageTone {
  const text = userMessage.toLowerCase();

  // 1. Check for vulnerable / distress / struggle indicators first
  const vulnerablePattern =
    /\b(?:tired|exhausted|burn(?:ed)?\s*out|drained|overwhelm(?:ed)?|too\s+much|heavy|can't\s+keep\s+up|swamped|anxious|scared|worry|worried|fear|racing|nervous|panic|uneasy|dread|stress|stressed|sad|crying|lonely|alone|lost|grief|hurt|heartbroken|empty|depressed|down|angry|mad|annoyed|frustrated|fight|argument|conflict|unfair|furious|failure|guilt|guilty|messed\s+up|my\s+fault|hate\s+myself|not\s+good\s+enough|lazy|struggl(?:e|ing)|hard\s+time|difficult)\b/;

  // 2. Check for positive / energized / celebratory indicators
  const positivePattern =
    /\b(?:good|great|excited|exciting|happy|proud|grateful|thankful|energetic|energized|hopeful|inspir(?:ed|ing)|motivated|joy|joyful|wonderful|celebrate|accomplished|love|loved|promoted|fantastic|awesome|thriving|creative|refreshed|optimistic|smiling|pleasant|fun|delighted|pretty\s+good|feeling\s+good|really\s+good|best|progress|win|succeeded|can't\s+wait|looking\s+forward)\b/;

  // If text has positive expressions without vulnerable words, classify as positive
  if (positivePattern.test(text) && !vulnerablePattern.test(text)) {
    return 'positive';
  }

  // If vulnerable words are present, classify as vulnerable
  if (vulnerablePattern.test(text)) {
    return 'vulnerable';
  }

  if (positivePattern.test(text)) {
    return 'positive';
  }

  // Default is reflective (neutral, planning, exploring, curiosity)
  return 'reflective';
}

/**
 * Extracts the user's core topic or goal smoothly without conversational filler or raw quote marks.
 */
export function extractTopicPhrase(text: string): string {
  let clean = text.trim().replace(/[.,!?;:]+$/, '');

  // Strip conversational prefixes
  clean = clean.replace(
    /^(?:hi\s+there|hello|hey|well|honestly|actually|to\s+be\s+honest)[,\s]*/i,
    ''
  );
  clean = clean.replace(
    /^(?:i\s+am|i'm\s+feeling|i'm|im\s+feeling|im|i\s+feel|i've\s+been\s+feeling|i\s+am\s+feeling)\s+(?:really|so|pretty|quite|a\s+bit|very)?\s*(?:good|great|happy|excited|tired|exhausted|okay|fine|sad|anxious|stressed|ready)?[,\s]*(?:and|but|just)?\s*/i,
    ''
  );
  clean = clean.replace(
    /^(?:(?:i\s+)?(?:just\s+)?(?:want\s+(?:to|some)?|'d\s+like\s+to|would\s+like\s+to|'m\s+hoping\s+to|hoping\s+to|trying\s+to|looking\s+to|need\s+to))\s+/i,
    ''
  );
  clean = clean.trim();

  if (clean.length === 0) return 'what you shared';
  if (clean.length > 50) return `${clean.slice(0, 47)}...`;
  return clean;
}

/**
 * Generates an emotionally attuned reflection tailored to the person's actual valence and situation.
 */
export function extractAttunedReflection(
  userMessage: string,
  fallback?: string,
  topicOverride?: string
): string {
  const text = userMessage.toLowerCase();
  const tone = classifyTone(userMessage);
  const topic = topicOverride || extractTopicPhrase(userMessage);

  if (/\b(?:peace|relief|breathing\s*room)\b/.test(text)) {
    return `I hear how deeply you are craving some quiet breathing room and gentle relief right now around ${topic}.`;
  }

  if (tone === 'positive') {
    if (/\b(?:finished|completed|passed|promoted|won|achieved|proud|progress|success)\b/.test(text)) {
      return `Congratulations on that! Making real progress with ${topic} is such an empowering feeling, and you should feel proud of showing up for yourself.`;
    }
    if (/\b(?:excited|exciting|energized|can't\s+wait|thrilled|inspired|motivated)\b/.test(text)) {
      return `I love feeling that genuine excitement and spark in your words! Bringing that positive energy to ${topic} gives us such a wonderful place to build from.`;
    }
    if (/\b(?:grateful|thankful|blessed|appreciate)\b/.test(text)) {
      return `Holding that sense of gratitude and appreciation brings such a warm, grounded energy to ${topic}.`;
    }
    if (/\b(?:calm|peaceful|quiet|rested|content|at\s+ease)\b/.test(text)) {
      return `It sounds like you are carrying a lovely sense of calm and clarity today, which is such a nice space to explore ${topic} from.`;
    }
    return `It is wonderful to hear that you are feeling good today. Bringing that lightness and positive momentum to ${topic} is a great foundation for our chat.`;
  }

  if (tone === 'vulnerable') {
    if (/\b(?:tired|exhausted|burn(?:ed)?\s*out|drained|overwhelm(?:ed)?|too\s+much|heavy|can't\s+keep\s+up|swamped)\b/.test(text)) {
      return 'I can hear how much energy this has been taking out of you, and how deeply drained and tired you feel carrying so much on your shoulders.';
    }
    if (/\b(?:anxious|scared|worry|worried|fear|racing|nervous|panic|uneasy|dread|stress|stressed)\b/.test(text)) {
      return 'It sounds like your mind has been spinning without giving you a chance to catch your breath, and that can feel so exhausting.';
    }
    if (/\b(?:sad|crying|lonely|alone|lost|grief|hurt|heartbroken|empty|depressed|down)\b/.test(text)) {
      return 'I can feel how much sadness is resting with you right now, and how heavy that feels to sit with.';
    }
    if (/\b(?:angry|mad|annoyed|frustrated|fight|argument|conflict|unfair|furious)\b/.test(text)) {
      return 'It makes complete sense that you would feel frustrated and upset after dealing with that kind of tension.';
    }
    if (/\b(?:failure|guilt|guilty|messed\s+up|my\s+fault|hate\s+myself|not\s+good\s+enough|lazy)\b/.test(text)) {
      return 'You are putting so much pressure on yourself right now, even though you have been trying your hardest through some really difficult days.';
    }
    return `Thank you for being so honest and open with me. Putting difficult feelings into words takes real bravery, and we can take all the time you need.`;
  }

  // Tone is reflective / neutral
  if (fallback) {
    return fallback;
  }

  if (/\b(?:plan|planning|organize|organizing|schedule|routine|habit|system)\b/.test(text)) {
    return `Taking intentional time to organize and reflect on ${topic} shows such thoughtful care for your days.`;
  }
  if (/\b(?:curious|thinking|wondering|deciding|choice|decision)\b/.test(text)) {
    return `It sounds like you are in a thoughtful, curious space today as you look at ${topic} and explore how to shape it.`;
  }

  return `It sounds like you are in a steady, reflective space today as you look at ${topic}.`;
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
              ? extractAttunedReflection(userMessage)
              : "Welcome. I'm really glad you're here today.";
          inquiry = previousStepReview
            ? `By the way, were you able to try the little step you set for yourself last time: "${truncate(previousStepReview, 45)}"?`
            : "What would make this quiet time feel most worth it for you?";
          technique = 'Gentle Listening';
          break;

        case 'CheckIn': {
          const activeText = userMessage.trim().length > 0 ? userMessage : state.contract || '';
          const tone = classifyTone(activeText);
          const topic = extractTopicPhrase(state.contract || userMessage);

          if (tone === 'positive') {
            reflection = extractAttunedReflection(
              activeText,
              `It is wonderful to hear that you are feeling good today! Bringing that positive energy to ${topic} is such a great place to begin.`,
              topic
            );
            inquiry = previousStepReview
              ? `By the way, were you able to try the little step you set for yourself last time: "${truncate(previousStepReview, 45)}"?`
              : 'With that positive energy in your corner today, what feels like the best place for us to focus our conversation?';
            technique = 'Celebrating Your Energy';
          } else if (tone === 'vulnerable') {
            reflection = extractAttunedReflection(
              activeText,
              `I hear how much has been weighing on you with ${topic}, and you don't have to carry any pressure here.`,
              topic
            );
            inquiry = previousStepReview
              ? `By the way, were you able to try the little step you set for yourself last time: "${truncate(previousStepReview, 45)}"?`
              : 'In this quiet space today, what would feel most gentle and supportive for you to focus on?';
            technique = 'Holding Safe Space';
          } else {
            reflection = extractAttunedReflection(
              activeText,
              `I hear you, and it sounds like you are in a clear, reflective space today as you look at ${topic}.`,
              topic
            );
            inquiry = previousStepReview
              ? `By the way, were you able to try the little step you set for yourself last time: "${truncate(previousStepReview, 45)}"?`
              : 'As we settle into our time together, what would make this conversation feel most meaningful and helpful for you?';
            technique = 'Checking In On You';
          }
          break;
        }

        case 'Focus': {
          const tone = classifyTone(userMessage);
          const topic = extractTopicPhrase(userMessage);

          if (tone === 'positive') {
            reflection = `Focusing on ${topic} sounds like such an exciting and worthwhile direction today.`;
            inquiry = 'If we look at one specific part of this that lights you up the most, where should we begin?';
            technique = 'Choosing What Matters';
          } else if (tone === 'vulnerable') {
            reflection = extractAttunedReflection(
              userMessage,
              `Focusing on ${topic} makes complete sense, especially with how much has been on your mind.`
            );
            inquiry =
              'If we could gently look at just one little piece of this together—without trying to fix everything at once—what matters most to you?';
            technique = 'Finding What Matters';
          } else {
            reflection = `Focusing on ${topic} gives us a really clear, grounded place to start.`;
            inquiry =
              'If we could gently explore just one key aspect of this together today, what feels most important to you?';
            technique = 'Clarifying Focus';
          }
          break;
        }

        case 'Explore': {
          const activeText = userMessage.trim().length > 0 ? userMessage : state.focusTopic || '';
          const tone = classifyTone(activeText);
          const topic = extractTopicPhrase(state.focusTopic || userMessage);

          if (tone === 'positive') {
            reflection = `When things are flowing nicely with ${topic}, you can really feel that momentum.`;
            inquiry = 'What makes this feel so meaningful to you, and what does it look like when it is at its best?';
            technique = 'Looking Deeper';
          } else if (tone === 'vulnerable') {
            reflection = extractAttunedReflection(
              userMessage,
              `It makes total sense that looking at ${topic} brings up these tender feelings.`,
              topic
            );
            inquiry = 'When that feeling is there, what feels like the trickiest or most tiring part to sit with?';
            technique = 'Gentle Exploration';
          } else {
            reflection = `Taking this time to look at ${topic} from different angles brings so much clarity.`;
            inquiry = 'When you think about this part of your life, what is working well right now, and what are you hoping might shift?';
            technique = 'Exploring Together';
          }
          break;
        }

        case 'Options': {
          const tone = classifyTone(userMessage);
          if (tone === 'positive') {
            reflection = 'You have such creative clarity and enthusiasm here.';
            inquiry = 'What is one exciting possibility or small experiment that comes to mind, even a tiny one?';
            technique = 'Exploring Possibilities';
          } else if (tone === 'vulnerable') {
            reflection = 'You have looked at this so gently and honestly today, with so much patience.';
            inquiry = 'What is one tiny, gentle possibility that comes to mind—even something very small and quiet?';
            technique = 'Gentle Possibilities';
          } else {
            reflection = 'You have brought so much thoughtful perspective and care to this conversation.';
            inquiry = 'Looking at the big picture, what are one or two gentle options or paths you might try?';
            technique = 'Gathering Ideas';
          }
          break;
        }

        case 'Commit': {
          const topic = extractTopicPhrase(userMessage);
          reflection = `Look at that—you have a clear, gentle path beginning to form around ${topic}.`;
          inquiry =
            'Take a look at the little step box on your screen below and type your small step there.';
          technique = 'Taking a Small Step';
          break;
        }

        case 'Close': {
          const tone = classifyTone(userMessage);
          if (tone === 'positive') {
            reflection =
              'You brought such wonderful energy and thoughtfulness to our chat today. I am really glad we had this time together.';
          } else {
            reflection =
              'You did such sweet, caring work for yourself today. Thank you for taking this quiet time for yourself.';
          }
          inquiry = 'What is one kind thought or takeaway you want to hold onto from our talk today?';
          technique = 'Warm Wrap-Up';
          break;
        }
      }
      break;
    }

    case 'deepen': {
      switch (replyPhase) {
        case 'Contract':
          reflection = extractAttunedReflection(userMessage);
          inquiry = 'What would make this quiet time feel most comfortable and supportive for you as we talk through this?';
          technique = 'Setting Our Space';
          break;

        case 'CheckIn': {
          const tone = classifyTone(userMessage);
          reflection = extractAttunedReflection(userMessage);
          if (tone === 'positive') {
            inquiry = 'What part of that good feeling or goal would you love to spend our time exploring today?';
          } else if (tone === 'vulnerable') {
            inquiry = 'When that feeling is there, what does your mind and body need most right now?';
          } else {
            inquiry = 'When you think about where you want to be with this, what feels most important to focus on today?';
          }
          technique = 'Listening Deeply';
          break;
        }

        case 'Focus':
          reflection = extractAttunedReflection(userMessage);
          inquiry = 'What makes that feel like the most meaningful part to focus on right now?';
          technique = 'Clarifying Focus';
          break;

        case 'Explore': {
          const tone = classifyTone(userMessage);
          const topic = extractTopicPhrase(userMessage);
          if (tone === 'positive') {
            reflection = extractAttunedReflection(
              userMessage,
              `When you imagine ${topic} growing and flourishing, that is such an inspiring picture.`
            );
            inquiry = 'What strengths or past experiences can you draw on to help this happen?';
            technique = 'Looking Deeper';
          } else if (tone === 'vulnerable') {
            reflection = extractAttunedReflection(
              userMessage,
              `It makes total sense that ${topic} feels heavy right now.`
            );
            inquiry = 'What quiet part of you wishes things could feel a little easier or different?';
            technique = 'Gentle Deepening';
          } else {
            reflection = extractAttunedReflection(
              userMessage,
              `Taking a step back to examine ${topic} thoughtfully is so valuable.`
            );
            inquiry = 'What are you noticing about what works and what gets in the way?';
            technique = 'Exploring Together';
          }
          break;
        }

        case 'Options':
          reflection = `${extractTopicPhrase(userMessage)} is a really thoughtful idea.`;
          inquiry = 'What else might be a tiny option, or does that one feel like the right place to begin?';
          technique = 'Gathering Ideas';
          break;

        case 'Commit':
          reflection = `${extractTopicPhrase(userMessage)} sounds like such a doable step.`;
          inquiry = 'How can we make this step so small that it feels completely effortless for you?';
          technique = 'Shrinking the Step';
          break;

        case 'Close':
          reflection = `Holding onto ${extractTopicPhrase(userMessage)} is such a sweet gift to yourself.`;
          inquiry = 'How does your mind feel right now as we get ready to wrap up?';
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
        'I hear that you are looking for ideas, and it is so natural to want suggestions. Because you know your life and your wisdom best, I will not tell you what to do, but we will explore gentle possibilities together when we get to options in a moment.';
      inquiry = 'From your own perspective, what feels like the most natural place to start?';
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
        'I hear how much is in your thoughts and heart right now. Let us take one slow, gentle breath together and pause for a quiet second.';
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
