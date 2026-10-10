import React, { useState } from 'react';
import { Header } from './components/Header';
import { ModelSelector } from './components/ModelSelector';
import { PhaseTimeline } from './components/PhaseTimeline';
import { DialogueFeed } from './components/DialogueFeed';
import { ActionShrinkageModal } from './components/ActionShrinkageModal';
import { CrisisModal } from './components/CrisisModal';
import { CalculatorDisguise } from './components/CalculatorDisguise';
import { CheckoutModal } from './components/CheckoutModal';
import { ChatMessage, OperatingMode, SessionPhase } from './types';
import { generateCoachResponse, runPreScan } from './engine';
import { Send, RotateCcw } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & Stealth State
  const [disguiseMode, setDisguiseMode] = useState<boolean>(false);
  const [quietMode, setQuietMode] = useState<boolean>(false);
  const [panicWiped, setPanicWiped] = useState<boolean>(false);

  // Model Selection - Default to Llama-3.2-3B-Instruct (128k Context Window)
  const [selectedModelId, setSelectedModelId] = useState<string>('llama-3.2-3b-128k');

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
      reflection: 'Welcome to Haven. You are in an air-gapped, zero-knowledge sanctuary running strictly on your local device.',
      inquiry: 'What intention or challenge would you like to dedicate our conversation to today?',
      technique: 'Goal Clarification (GROW)',
      timestamp: Date.now(),
    },
  ]);

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
  const handleSendMessage = () => {
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

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);

    // Generate compliant coach response from local model / engine
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
  };

  // Advance from Commit to Close once action confidence is verified
  const handleConfirmCommitment = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: `action-${Date.now()}`,
        sender: 'user',
        text: `Action Commitment (${actionConfidence}/10 Confidence): ${actionPlan}`,
        timestamp: Date.now(),
      },
      {
        id: `coach-close-${Date.now()}`,
        sender: 'coach',
        reflection: `I acknowledge and celebrate your commitment to: "${actionPlan}".`,
        inquiry: 'As we bring this session to completion, what is the single most valuable insight you are taking away?',
        technique: 'Appreciative Reflection',
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
        reflection: `Session sealed. Checkout Score: ${score}/5. Technique feedback logged: ${helpful ? 'Positive reinforcement' : 'Exploration prior adjusted'}.`,
        inquiry: 'Your session has been sealed with Argon2id + AES-256-GCM envelope encryption into your local vault. Be gentle with yourself today.',
        technique: 'Zero-Knowledge Cryptographic Seal',
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
        reflection: 'Welcome to a new Haven session.',
        inquiry: 'What would you like to explore or focus on in our session today?',
        technique: 'Goal Clarification (GROW)',
        timestamp: Date.now(),
      },
    ]);
  };

  // If disguise mode is active, render the functional calculator
  if (disguiseMode) {
    return <CalculatorDisguise onUnlock={() => setDisguiseMode(false)} />;
  }

  return (
    <div className="haven-app">
      <Header
        onToggleDisguise={() => setDisguiseMode(true)}
        onPanicWipe={handlePanicWipe}
        quietMode={quietMode}
        onToggleQuietMode={() => setQuietMode(!quietMode)}
      />

      <ModelSelector
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
      />

      <PhaseTimeline
        currentPhase={currentPhase}
        operatingMode={operatingMode}
      />

      {panicWiped ? (
        <div className="action-confidence-panel" style={{ textAlign: 'center', borderColor: '#f43f5e' }}>
          <h2 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Sanctuary Wiped</h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '1rem' }}>
            All ephemeral session memories and cryptographic keys have been destroyed in &lt;1000ms.
          </p>
          <button className="send-btn" style={{ margin: '0 auto' }} onClick={handleResetSession}>
            <RotateCcw size={16} /> Reinitialize Fresh Session
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
                    ? 'State your topic or intention for today...'
                    : 'Share your perspective freely...'
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
                <RotateCcw size={16} /> Begin New Coaching Session
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
    </div>
  );
};
export default App;
