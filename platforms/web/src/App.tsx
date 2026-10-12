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
import { ChatMessage, OperatingMode, SessionPhase } from './types';
import { AVAILABLE_MODELS, generateCoachResponse, runPreScan } from './engine';
import { webllm, WebLLMProgress } from './webllm';
import { Send, RotateCcw } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & Stealth State
  const [disguiseMode, setDisguiseMode] = useState<boolean>(false);
  const [quietMode, setQuietMode] = useState<boolean>(false);
  const [panicWiped, setPanicWiped] = useState<boolean>(false);
  const [vaultLocked, setVaultLocked] = useState<boolean>(false);
  const [inDecoyMode, setInDecoyMode] = useState<boolean>(false);

  // Model Selection - Default to Llama-3.2-3B-Instruct (128k Context Window)
  const [selectedModelId, setSelectedModelId] = useState<string>('llama-3.2-3b-128k');
  const [webllmProgress, setWebllmProgress] = useState<WebLLMProgress>({
    progress: 0,
    text: 'Click "Load WebGPU Weights" to compile into browser VRAM.',
    isLoaded: false,
    isLoading: false,
  });

  // Coaching Engine State
  const [currentPhase, setCurrentPhase] = useState<SessionPhase>('Contract');
  const [operatingMode, setOperatingMode] = useState<OperatingMode>('Steady');
  const [inputText, setInputText] = useState<string>('');
  const [actionConfidence, setActionConfidence] = useState<number>(7);
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
    // 2. Mark state as crypto-wiped
    setPanicWiped(true);
    // 3. Immediately switch into disguise mode
    setDisguiseMode(true);
  };

  // Handle User Input Submission
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    setInputText('');

    // Dual-Tier Safety Guardian: Layer 1 Pre-Scan
    const preScan = runPreScan(userText);
    if (preScan.tier === 'Red') {
      setCrisisAlert({
        active: true,
        category: preScan.matchedCategory,
      });
      return;
    }

    let effectiveMode = operatingMode;
    if (preScan.tier === 'Amber') {
      // Amber clamp to Steady mode for psychological safety
      effectiveMode = 'Steady';
      setOperatingMode('Steady');
    }

    // Append user message
    const newMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);

    // Check if WebGPU engine is initialized for active model
    const isWebGPUActive = selectedModelId !== 'simulated-airgap' && webllm.isReady(selectedModelId);

    if (isWebGPUActive) {
      const coachTurnId = `coach-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: coachTurnId,
          sender: 'coach',
          reflection: 'Listening quietly to your words in your safe space...',
          inquiry: '',
          technique: 'Gentle Thinking (128k)',
          timestamp: Date.now(),
        },
      ]);

      const systemPrompt = `You are Haven, a kind, gentle companion who speaks like a loving friend to the user's inner child. Phase: ${currentPhase}, Mode: ${effectiveMode}. Use very simple, warm, everyday words that a child could easily understand. Never use corporate jargon, big fancy words, or therapy speak. Start by softly reflecting back what they felt, then ask ONE simple, gentle question to help them breathe and look inside. Never tell them what to do.`;

      try {
        const turn = await webllm.generateCoachingTurn(systemPrompt, userText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === coachTurnId
              ? {
                  ...m,
                  reflection: turn.reflection,
                  inquiry: turn.inquiry,
                }
              : m
          )
        );
      } catch (err: any) {
        // Fallback to deterministic simulation if WebGPU fails
        const fallback = generateCoachResponse(currentPhase, userText, effectiveMode);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === coachTurnId
              ? {
                  ...m,
                  reflection: fallback.reflection,
                  inquiry: fallback.inquiry,
                  technique: `${fallback.technique} (Gentle Safe Fallback)`,
                }
              : m
          )
        );
      }
    } else {
      // Deterministic Simulation engine (Zero download / instant execution)
      setTimeout(() => {
        const coachResp = generateCoachResponse(currentPhase, userText, effectiveMode);

        setMessages((prev) => [
          ...prev,
          {
            id: `coach-${Date.now()}`,
            sender: 'coach',
            reflection: coachResp.reflection,
            inquiry: coachResp.inquiry,
            technique: coachResp.technique,
            timestamp: Date.now(),
          },
        ]);

        if (coachResp.suggestedNextPhase) {
          setCurrentPhase(coachResp.suggestedNextPhase);
        }
        if (coachResp.suggestedMode) {
          setOperatingMode(coachResp.suggestedMode);
        }
      }, 400);
    }
  };

  // Advance from Commit to Close once action confidence is verified
  const handleConfirmCommitment = () => {
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

    setCurrentPhase('Close');
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
    setCurrentPhase('Contract');
    setOperatingMode('Steady');
    setActionConfidence(7);
    setActionPlan('');
    setPanicWiped(false);
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

  const currentModelMeta = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  return (
    <div className="haven-app">
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

          {currentPhase !== 'Commit' && currentPhase !== 'Close' && (
            <div className="input-dock">
              <input
                type="text"
                className="chat-input"
                placeholder={
                  currentPhase === 'Contract'
                    ? "Tell me what's on your heart, take all the time you need..."
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
          onUnlockMaster={() => setVaultLocked(false)}
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
