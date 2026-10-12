import React from 'react';
import { Target, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const isBelowThreshold = confidence < 8;

  return (
    <div className="action-confidence-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Target size={18} color="#f59e0b" />
        <h3 style={{ fontSize: '1rem', color: '#f8fafc' }}>
          Taking a Gentle Little Step
        </h3>
      </div>

      <div style={{ margin: '0.6rem 0' }}>
        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          What is one small, kind thing you'd like to try doing?
        </label>
        <input
          type="text"
          className="chat-input"
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            marginTop: '0.35rem',
            padding: '0.5rem 0.75rem',
          }}
          placeholder="e.g. Step outside to feel the air for 5 minutes, or write down one honest thought"
          value={actionText}
          onChange={(e) => onActionTextChange(e.target.value)}
        />
      </div>

      <div className="slider-container">
        <label style={{ fontSize: '0.85rem', color: '#94a3b8', minWidth: '150px' }}>
          How does it feel? (0 = Too hard, 10 = Easy):
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
        <div className="slider-val">{confidence} / 10</div>
      </div>

      {isBelowThreshold ? (
        <div className="shrinkage-alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            <AlertCircle size={15} />
            <span>Let's Make This Step Smaller & Gentler</span>
          </div>
          <p>
            That step might be a bit too heavy right now, and that is completely okay! When we feel overwhelmed or tired, we make the step tiny.
            What is a much smaller baby-step that feels like an easy 9 or 10? Even something like taking three deep breaths, drinking a glass of water, or opening a notebook counts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>This feels gentle and doable ({confidence}/10). You're ready.</span>
        </div>
      )}

      <button
        className="send-btn"
        style={{
          width: '100%',
          marginTop: '0.85rem',
          justifyContent: 'center',
          opacity: actionText.trim() === '' ? 0.5 : 1,
        }}
        disabled={actionText.trim() === ''}
        onClick={onConfirmAction}
      >
        I Can Do This Little Step
      </button>
    </div>
  );
};
