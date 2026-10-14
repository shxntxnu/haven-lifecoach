import React, { useState } from 'react';
import { Header } from './components/Header';
import { ModelSelector } from './components/ModelSelector';
import { PhaseTimeline } from './components/PhaseTimeline';
import { DialogueFeed } from './components/DialogueFeed';
import { ActionShrinkageModal } from './components/ActionShrinkageModal';
import { CrisisModal } from './components/CrisisModal';
import { CalculatorDisguise } from './components/CalculatorDisguise';
import { CheckoutModal } from './components/CheckoutModal';
import { ModelProgressHUD } from './components/ModelProgressHUD';
import { VaultAuthModal } from './components/VaultAuthModal';
import { DecoyVaultView } from './components/DecoyVaultView';
import { WelcomePage } from './components/WelcomePage';
import { ChatMessage, OperatingMode, SessionPhase } from './types';
import { AVAILABLE_MODELS } from './engine';
import { webllm, WebLLMProgress } from './webllm';
import { createInitialFlowState, confirmCommitment, type FlowState } from './flow/controller';
import { runTurn, createSafeFallback } from './orchestrator';
import type { DialogueTurn } from './prompt/builder';
import {
  getLastStep,
  saveLastStep,
  markLastStepReviewed,
  clearJourneyStorage,
} from './storage/journeyStorage';
import { Send, RotateCcw, Clock, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & Stealth State
  const [disguiseMode, setDisguiseMode] = useState<boolean>(false);
  const [quietMode, setQuietMode] = useState<boolean>(false);
  const [panicWiped, setPanicWiped] = useState<boolean>(false);
  const [vaultLocked, setVaultLocked] = useState<boolean>(false);
  const [inDecoyMode, setInDecoyMode] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(false);

  // Model Selection - Default to Llama-3.2-3B-Instruct (128k Context Window)
  const [selectedModelId, setSelectedModelId] = useState<string>('llama-3.2-3b-128k');
  const [webllmProgress, setWebllmProgress] = useState<WebLLMProgress>({
    progress: 0,
    text: 'Click "Load WebGPU Weights" to compile into browser VRAM.',
    isLoaded: false,
    isLoading: false,
  });

  // Coaching Engine State
  const [flowState, setFlowState] = useState<FlowState>(createInitialFlowState());
  const [currentPhase, setCurrentPhase] = useState<SessionPhase>('Contract');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('Steady');
  const [inputText, setInputText] = useState<string>('');
  const [actionConfidence, setActionConfidence] = useState<number>(9);
  const [actionPlan, setActionPlan] = useState<string>('');
  const [showCheckout, setShowCheckout] = useState<boolean>(false);

  // Safety Guardian State
  const [crisisAlert, setCrisisAlert] = useState<{ active: boolean; category?: string }>({
    active: false,
  });

  // Typing Indicator for natural texting cadence (Option A)
  const [isCoachTyping, setIsCoachTyping] = useState<boolean>(false);

  // Dialogue History - contextual greeting on arrival
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const lastStep = getLastStep();
    if (lastStep && !lastStep.reviewed) {
      return [
        {
          id: 'init-1',
          sender: 'coach',
          text: 'How are you feeling today?',
          technique: 'Gentle Welcome',
          timestamp: Date.now(),
        },
      ];
    }
    return [
      {
        id: 'init-1',
        sender: 'coach',
        text: "Welcome. How are you feeling today, and what's on your mind?",
        technique: 'Gentle Welcome',
        timestamp: Date.now(),
      },
    ];
  });

  // Handle WebGPU Model Initialization
  const handleInitWebGPU = async () => {
    await webllm.loadModel(selectedModelId, (p) => setWebllmProgress(p));
  };

  // Natural text conversation delivery (Option A: separate bubbles with typing delay)
  const deliverCoachReply = (
    placeholderId: string,
    reflection: string,
    inquiry: string,
    technique?: string
  ) => {
    const hasReflection = Boolean(reflection && reflection.trim());
    const hasInquiry = Boolean(inquiry && inquiry.trim());

    if (hasReflection && hasInquiry) {
      // 1. First bubble: reflection
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                id: placeholderId,
                sender: 'coach',
                text: reflection.trim(),
                technique,
                timestamp: Date.now(),
              }
            : m
        )
      );
      // 2. Typing indicator between bubbles
      setIsCoachTyping(true);
      // 3. Second bubble: inquiry after natural pause
      setTimeout(() => {
        setIsCoachTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `inq-${Date.now()}`,
            sender: 'coach',
            text: inquiry.trim(),
            timestamp: Date.now(),
          },
        ]);
      }, 600);
    } else {
      setIsCoachTyping(false);
      const singleText = (hasReflection ? reflection : inquiry) || '';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                id: placeholderId,
                sender: 'coach',
                text: singleText.trim(),
                technique,
                timestamp: Date.now(),
              }
            : m
        )
      );
    }
  };

  // Handle Panic Wipe (1000ms panic button)
  const handlePanicWipe = () => {
    clearJourneyStorage();
    setIsCoachTyping(false);
    // 1. Scramble & purge in-memory dialogue
    setMessages([]);
    setInputText('');
    setActionPlan('');
    setFlowState(createInitialFlowState());
    // 2. Mark state as crypto-wiped
    setPanicWiped(true);
    // 3. Immediately switch into disguise mode
    setDisguiseMode(true);
  };

  // Handle User Input Submission via Unified Orchestrator Pipeline
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');

    // Append user message
    const userMsgId = `usr-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);

    // If currently in Commit phase, typing in chat updates the action step directly
    if (currentPhase === 'Commit') {
      setActionPlan(userText);
    }

    const isWebGPUActive =
      selectedModelId !== 'simulated-airgap' && webllm.isReady(selectedModelId);
    const coachTurnId = `coach-${Date.now()}`;

    // Append placeholder for coach thinking
    setMessages((prev) => [
      ...prev,
      {
        id: coachTurnId,
        sender: 'coach',
        text: 'Listening quietly in your safe space...',
        technique: isWebGPUActive ? 'Gentle Thinking (128k)' : 'Gentle Listening',
        timestamp: Date.now(),
      },
    ]);

    const history: DialogueTurn[] = messages
      .filter((m) => m.id !== 'init-1' || m.sender === 'coach')
      .map((m) => ({
        speaker: m.sender === 'user' ? 'person' : 'haven',
        text:
          m.text ??
          (m.reflection && m.inquiry
            ? `${m.reflection} ${m.inquiry}`
            : m.reflection || m.inquiry || ''),
      }));

    const lastStep = getLastStep();
    const previousStepReview =
      currentPhase === 'Contract' && lastStep && !lastStep.reviewed
        ? lastStep.plan
        : undefined;

    try {
      const result = await runTurn({
        userMessage: userText,
        flowState,
        history,
        backend: isWebGPUActive
          ? (msgs, onChunk) => webllm.generateChat(msgs, onChunk)
          : undefined,
        modelId: selectedModelId,
        previousStepReview,
      });

      if (result.kind === 'crisis') {
        setIsCoachTyping(false);
        setMessages((prev) => prev.filter((m) => m.id !== coachTurnId));
        setCrisisAlert({
          active: true,
          category: result.matchedPatterns.join(', '),
        });
        return;
      }

      if (previousStepReview) {
        markLastStepReviewed();
      }

      setFlowState(result.nextState);
      setCurrentPhase(result.nextState.phase);
      setOperatingMode(result.nextState.mode);

      if (result.nextState.actionSeed && !actionPlan) {
        setActionPlan(result.nextState.actionSeed);
      }

      deliverCoachReply(
        coachTurnId,
        result.reflection,
        result.inquiry,
        result.technique
      );
    } catch {
      const fallback = createSafeFallback({
        state: flowState,
        action: 'stay',
        replyPhase: currentPhase,
        replyKind: 'deepen',
        reason: 'error_fallback',
        adviceRequested: false,
        adviceUnlocked: false,
      });

      deliverCoachReply(
        coachTurnId,
        fallback.reflection,
        fallback.inquiry,
        'Gentle Safe Fallback'
      );
    }
  };

  // Handle Person-led Pacing Overrides
  const handlePacingChoice = async (intent: 'ready' | 'hold') => {
    const userText =
      intent === 'ready'
        ? "I'm ready to move on"
        : "I'm not ready yet, let's take our time";

    const userMsgId = `usr-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);

    const isWebGPUActive =
      selectedModelId !== 'simulated-airgap' && webllm.isReady(selectedModelId);
    const coachTurnId = `coach-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: coachTurnId,
        sender: 'coach',
        reflection: 'Listening quietly to your words in your safe space...',
        inquiry: '',
        technique: isWebGPUActive ? 'Gentle Thinking (128k)' : 'Gentle Listening',
        timestamp: Date.now(),
      },
    ]);

    const history: DialogueTurn[] = messages
      .filter((m) => m.id !== 'init-1' || m.sender === 'coach')
      .map((m) => ({
        speaker: m.sender === 'user' ? 'person' : 'haven',
        text:
          m.text ??
          (m.reflection && m.inquiry
            ? `${m.reflection} ${m.inquiry}`
            : m.reflection || m.inquiry || ''),
      }));

    try {
      const result = await runTurn({
        userMessage: userText,
        flowState,
        history,
        intent,
        backend: isWebGPUActive
          ? (msgs, onChunk) => webllm.generateChat(msgs, onChunk)
          : undefined,
        modelId: selectedModelId,
      });

      if (result.kind === 'crisis') {
        setIsCoachTyping(false);
        setMessages((prev) => prev.filter((m) => m.id !== coachTurnId));
        setCrisisAlert({
          active: true,
          category: result.matchedPatterns.join(', '),
        });
        return;
      }

      setFlowState(result.nextState);
      setCurrentPhase(result.nextState.phase);
      setOperatingMode(result.nextState.mode);

      if (result.nextState.actionSeed && !actionPlan) {
        setActionPlan(result.nextState.actionSeed);
      }

      deliverCoachReply(
        coachTurnId,
        result.reflection,
        result.inquiry,
        result.technique
      );
    } catch {
      const fallback = createSafeFallback({
        state: flowState,
        action: 'stay',
        replyPhase: currentPhase,
        replyKind: intent === 'hold' ? 'honor-hold' : 'deepen',
        reason: 'error_fallback',
        adviceRequested: false,
        adviceUnlocked: false,
      });

      deliverCoachReply(
        coachTurnId,
        fallback.reflection,
        fallback.inquiry,
        'Gentle Safe Fallback'
      );
    }
  };

  // Advance from Commit to Close once action confidence is verified
  const handleConfirmCommitment = () => {
    const decision = confirmCommitment(flowState, actionPlan, actionConfidence);
    setFlowState(decision.state);
    setCurrentPhase(decision.state.phase);
    setOperatingMode(decision.state.mode);

    // Save step to private on-device storage
    saveLastStep(actionPlan, actionConfidence);

    const actionMsgId = `action-${Date.now()}`;
    const coachCloseId = `coach-close-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: actionMsgId,
        sender: 'user',
        text: `My Little Step (${actionConfidence}/10 Ready): ${actionPlan}`,
        timestamp: Date.now(),
      },
      {
        id: coachCloseId,
        sender: 'coach',
        text: `I'm holding this sweet step with you: "${actionPlan}".`,
        technique: 'Holding What Matters',
        timestamp: Date.now(),
      },
    ]);

    setIsCoachTyping(true);
    setTimeout(() => {
      setIsCoachTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `coach-close-inq-${Date.now()}`,
          sender: 'coach',
          text: 'As we get ready to rest, what is one kind thing you are taking away with you today?',
          timestamp: Date.now(),
        },
      ]);
    }, 600);

    setShowCheckout(true);
  };

  // Final Session Checkout & Envelope Encryption
  const handleCheckoutComplete = (score: number, helpful: boolean) => {
    setShowCheckout(false);
    const closedRefId = `closed-ref-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: closedRefId,
        sender: 'coach',
        text: `Your words are sealed and safe. You rated our chat ${score}/5. Feedback noted: ${helpful ? 'Felt gentle & good' : 'Will be even softer next time'}.`,
        technique: 'Safe & Sound',
        timestamp: Date.now(),
      },
    ]);

    setIsCoachTyping(true);
    setTimeout(() => {
      setIsCoachTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `closed-inq-${Date.now()}`,
          sender: 'coach',
          text: 'Your chat is locked safely inside your private sanctuary on your device. Be gentle with yourself today.',
          timestamp: Date.now(),
        },
      ]);
    }, 600);
  };

  // Reset Session
  const handleResetSession = () => {
    clearJourneyStorage();
    setIsCoachTyping(false);
    setFlowState(createInitialFlowState());
    setCurrentPhase('Contract');
    setOperatingMode('Steady');
    setActionConfidence(9);
    setActionPlan('');
    setPanicWiped(false);
    setHasCheckedIn(false);
    setMessages([
      {
        id: 'init-new',
        sender: 'coach',
        text: "Welcome. How are you feeling today, and what's on your mind?",
        technique: 'Gentle Welcome',
        timestamp: Date.now(),
      },
    ]);
  };

  // If disguise mode is active, render the functional calculator
  if (disguiseMode) {
    return <CalculatorDisguise onUnlock={() => setDisguiseMode(false)} />;
  }

  // If decoy vault is active, render the generic personal notes
  if (inDecoyMode) {
    return <DecoyVaultView onRelock={() => setInDecoyMode(false)} />;
  }

  // If user hasn't checked in yet, render the Welcome Greeting Page
  if (!hasCheckedIn) {
    return (
      <div className="haven-app">
        <WelcomePage
          onCheckIn={() => setHasCheckedIn(true)}
          onToggleDisguise={() => setDisguiseMode(true)}
          onPanicWipe={handlePanicWipe}
          quietMode={quietMode}
          onToggleQuietMode={() => setQuietMode(!quietMode)}
          onLockVault={() => setVaultLocked(true)}
        />
        {vaultLocked && (
          <VaultAuthModal
            onUnlockMaster={() => {
              setVaultLocked(false);
              setHasCheckedIn(false);
            }}
            onUnlockDecoy={() => {
              setVaultLocked(false);
              setInDecoyMode(true);
            }}
          />
        )}
      </div>
    );
  }

  const currentModelMeta = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  return (
    <div className="haven-app sanctuary-view">
      <Header
        onToggleDisguise={() => setDisguiseMode(true)}
        onPanicWipe={handlePanicWipe}
        quietMode={quietMode}
        onToggleQuietMode={() => setQuietMode(!quietMode)}
        onLockVault={() => setVaultLocked(true)}
      />

      <ModelSelector
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
      />

      {selectedModelId !== 'simulated-airgap' && (
        <ModelProgressHUD
          modelName={currentModelMeta.name}
          progress={webllmProgress}
          onInitialize={handleInitWebGPU}
          onFallbackToSim={() => setSelectedModelId('simulated-airgap')}
        />
      )}

      <PhaseTimeline
        currentPhase={currentPhase}
        operatingMode={operatingMode}
      />

      {panicWiped ? (
        <div className="action-confidence-panel" style={{ textAlign: 'center', borderColor: '#f43f5e' }}>
          <h2 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Your Space is Fresh & Clean</h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Everything we talked about has been completely wiped away. You are safe.
          </p>
          <button className="send-btn" style={{ margin: '0 auto' }} onClick={handleResetSession}>
            <RotateCcw size={16} /> Start a Fresh Chat
          </button>
        </div>
      ) : (
        <>
          <DialogueFeed messages={messages} isTyping={isCoachTyping} />

          {currentPhase === 'Commit' && (
            <ActionShrinkageModal
              confidence={actionConfidence}
              onConfidenceChange={setActionConfidence}
              actionText={actionPlan}
              onActionTextChange={setActionPlan}
              onConfirmAction={handleConfirmCommitment}
            />
          )}

          {currentPhase !== 'Close' && (
            <div style={{ marginTop: currentPhase === 'Commit' ? '0.85rem' : '0.5rem' }}>
              {currentPhase !== 'Commit' && (
                <div className="pacing-bar">
                  <button
                    className="pacing-btn hold"
                    onClick={() => handlePacingChoice('hold')}
                    type="button"
                    title="Tell Haven you'd like to stay in this part a bit longer"
                  >
                    <Clock size={12} />
                    <span>Not ready yet</span>
                  </button>
                  <button
                    className="pacing-btn"
                    onClick={() => handlePacingChoice('ready')}
                    type="button"
                    title="Tell Haven you feel ready to move forward"
                  >
                    <ArrowRight size={12} />
                    <span>I'm ready to move on</span>
                  </button>
                </div>
              )}
              <div className="input-dock">
                <input
                  type="text"
                  className="chat-input"
                  placeholder={
                    currentPhase === 'Contract'
                      ? "Tell me what's on your mind, take all the time you need..."
                      : currentPhase === 'Commit'
                      ? "Type your little step or reply to Haven here..."
                      : "Whatever you want to say is okay here..."
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!inputText.trim()}
                  aria-label="Send Message"
                >
                  <span>Send</span>
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}

          {currentPhase === 'Close' && !showCheckout && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                className="icon-btn"
                style={{ margin: '0 auto', padding: '0.6rem 1.2rem', gap: '0.5rem', color: '#14b8a6' }}
                onClick={handleResetSession}
              >
                <RotateCcw size={16} /> Start a New Gentle Chat
              </button>
            </div>
          )}
        </>
      )}

      {crisisAlert.active && (
        <CrisisModal
          matchedCategory={crisisAlert.category}
          onAcknowledge={() => setCrisisAlert({ active: false })}
        />
      )}

      {showCheckout && (
        <CheckoutModal onComplete={handleCheckoutComplete} />
      )}

      {vaultLocked && (
        <VaultAuthModal
          onUnlockMaster={() => {
            setVaultLocked(false);
            setHasCheckedIn(false);
          }}
          onUnlockDecoy={() => {
            setVaultLocked(false);
            setInDecoyMode(true);
          }}
        />
      )}
    </div>
  );
};
export default App;
