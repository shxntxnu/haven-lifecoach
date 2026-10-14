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
import { Send, RotateCcw } from 'lucide-react';

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

  // Dialogue History
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'coach',
      reflection: 'Hi there. You are completely safe here in your private sanctuary. Take a slow, gentle breath.',
      inquiry: "What's on your mind or resting on your heart today?",
      technique: 'Gentle Welcome',
      timestamp: Date.now(),
    },
  ]);

  // Handle WebGPU Model Initialization
  const handleInitWebGPU = async () => {
    await webllm.loadModel(selectedModelId, (p) => setWebllmProgress(p));
  };

  // Handle Panic Wipe (1000ms panic button)
  const handlePanicWipe = () => {
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
        backend: isWebGPUActive
          ? (msgs, onChunk) => webllm.generateChat(msgs, onChunk)
          : undefined,
        modelId: selectedModelId,
      });

      if (result.kind === 'crisis') {
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

      setMessages((prev) =>
        prev.map((m) =>
          m.id === coachTurnId
            ? {
                ...m,
                reflection: result.reflection,
                inquiry: result.inquiry,
                technique: result.technique,
              }
            : m
        )
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

      setMessages((prev) =>
        prev.map((m) =>
          m.id === coachTurnId
            ? {
                ...m,
                reflection: fallback.reflection,
                inquiry: fallback.inquiry,
                technique: 'Gentle Safe Fallback',
              }
            : m
        )
      );
    }
  };

  // Advance from Commit to Close once action confidence is verified
  const handleConfirmCommitment = () => {
    const decision = confirmCommitment(flowState, actionPlan, actionConfidence);
    setFlowState(decision.state);
    setCurrentPhase(decision.state.phase);
    setOperatingMode(decision.state.mode);

    setMessages((prev) => [
      ...prev,
      {
        id: `action-${Date.now()}`,
        sender: 'user',
        text: `My Little Step (${actionConfidence}/10 Ready): ${actionPlan}`,
        timestamp: Date.now(),
      },
      {
        id: `coach-close-${Date.now()}`,
        sender: 'coach',
        reflection: `I'm holding this sweet step with you: "${actionPlan}".`,
        inquiry: 'As we get ready to rest, what is one kind thing you are taking away with you today?',
        technique: 'Holding What Matters',
        timestamp: Date.now(),
      },
    ]);

    setShowCheckout(true);
  };

  // Final Session Checkout & Envelope Encryption
  const handleCheckoutComplete = (score: number, helpful: boolean) => {
    setShowCheckout(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `closed-${Date.now()}`,
        sender: 'coach',
        reflection: `Your words are sealed and safe. You rated our chat ${score}/5. Feedback noted: ${helpful ? 'Felt gentle & good' : 'Will be even softer next time'}.`,
        inquiry: 'Your chat is locked safely inside your private sanctuary on your device. Be gentle with yourself today.',
        technique: 'Safe & Sound',
        timestamp: Date.now(),
      },
    ]);
  };

  // Reset Session
  const handleResetSession = () => {
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
        reflection: 'Welcome back to your safe space.',
        inquiry: "What feels most important to talk about today?",
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
          <DialogueFeed messages={messages} />

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
            <div className="input-dock" style={{ marginTop: currentPhase === 'Commit' ? '0.85rem' : 0 }}>
              <input
                type="text"
                className="chat-input"
                placeholder={
                  currentPhase === 'Contract'
                    ? "Tell me what's on your heart, take all the time you need..."
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
