import React from 'react';
import { Target, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

interface ActionShrinkageProps {
  confidence: number;
  onConfidenceChange: (val: number) => void;
  actionText: string;
  onActionTextChange: (text: string) => void;
  onConfirmAction: () => void;
}

export const ActionShrinkageModal: React.FC<ActionShrinkageProps> = ({
  confidence,
  onConfidenceChange,
  actionText,
  onActionTextChange,
  onConfirmAction,
}) => {
  const hasAction = actionText.trim().length > 0;
  const isBelowThreshold = confidence < 8;
  const canConfirm = hasAction && !isBelowThreshold;

  return (
    <div className="action-confidence-panel" style={{ border: '1px solid rgba(20, 184, 166, 0.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <Target size={18} color="#2dd4bf" />
        <h3 style={{ fontSize: '1rem', color: '#f8fafc', margin: 0 }}>
          Taking a Gentle Little Step
        </h3>
      </div>
      <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 0.85rem 0', lineHeight: 1.4 }}>
        We are wrapping up our time together. Choose one tiny, stress-free thing you can do for yourself today so you leave feeling lighter.
      </p>

      <div style={{ margin: '0.6rem 0' }}>
        <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: '0.3rem' }}>
          1. What is one small, kind thing you'd like to try doing?
        </label>
        <input
          type="text"
          className="chat-input"
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.45)',
            border: hasAction ? '1px solid rgba(20, 184, 166, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            padding: '0.6rem 0.85rem',
            color: '#f8fafc',
          }}
          placeholder="e.g. Sit outside for 3 minutes, drink a glass of water, or take three deep breaths"
          value={actionText}
          onChange={(e) => onActionTextChange(e.target.value)}
        />
      </div>

      <div className="slider-container" style={{ margin: '0.85rem 0 0.5rem 0' }}>
        <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500, minWidth: '170px' }}>
          2. How easy does it feel? (0 = Hard, 10 = Easy):
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={confidence}
          onChange={(e) => onConfidenceChange(Number(e.target.value))}
          className="slider-input"
          aria-label="Confidence score from 0 to 10"
        />
        <div className="slider-val" style={{ color: isBelowThreshold ? '#f59e0b' : '#34d399' }}>
          {confidence} / 10
        </div>
      </div>

      {/* Helpful Direction States */}
      {!hasAction && (
        <div
          style={{
            background: 'rgba(20, 184, 166, 0.08)',
            border: '1px solid rgba(20, 184, 166, 0.25)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            marginTop: '0.6rem',
            fontSize: '0.85rem',
            color: '#99f6e4',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Sparkles size={16} color="#2dd4bf" style={{ flexShrink: 0 }} />
          <span>
            <strong>Next step:</strong> Type one little thing in the box above (or in the chat). Aim for something that feels easy and stress-free!
          </span>
        </div>
      )}

      {hasAction && isBelowThreshold && (
        <div className="shrinkage-alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            <AlertCircle size={15} />
            <span>Let's Make This Step Smaller & Gentler</span>
          </div>
          <p>
            A rating of {confidence}/10 means this might feel a little bit heavy or tiring right now, and that is completely okay! When we feel overwhelmed, we make the step tiny.
            What is a much smaller baby-step that feels like an easy 8, 9, or 10? Even taking three deep breaths, drinking a glass of water, or opening a window counts.
          </p>
        </div>
      )}

      {hasAction && !isBelowThreshold && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '0.55rem 0.85rem',
            color: '#34d399',
            fontSize: '0.85rem',
            marginTop: '0.6rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>This feels gentle and wonderfully doable ({confidence}/10). You're ready to wrap up!</span>
        </div>
      )}

      <button
        className="send-btn"
        style={{
          width: '100%',
          marginTop: '0.85rem',
          justifyContent: 'center',
          background: canConfirm
            ? 'linear-gradient(135deg, #14b8a6, #0d9488)'
            : '#334155',
          color: canConfirm ? '#042f2e' : '#94a3b8',
          cursor: canConfirm ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          boxShadow: canConfirm ? '0 0 16px rgba(20, 184, 166, 0.35)' : 'none',
        }}
        disabled={!canConfirm}
        onClick={onConfirmAction}
      >
        {!hasAction
          ? '✍️ Type your little step in the box above to continue'
          : isBelowThreshold
          ? '🌿 Make step smaller or adjust slider to 8+ to proceed'
          : '✨ I Can Do This Little Step — Finish Chat →'}
      </button>
    </div>
  );
};
