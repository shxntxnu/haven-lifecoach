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
          Action Formulation & Confidence Calibration
        </h3>
      </div>

      <div style={{ margin: '0.6rem 0' }}>
        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Your Concrete Action Commitment:
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
          placeholder="e.g. Schedule a 15-minute alignment call with Sarah tomorrow by 10 AM"
          value={actionText}
          onChange={(e) => onActionTextChange(e.target.value)}
        />
      </div>

      <div className="slider-container">
        <label style={{ fontSize: '0.85rem', color: '#94a3b8', minWidth: '150px' }}>
          Readiness / Confidence:
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
            <span>Action Shrinkage Protocol Triggered</span>
          </div>
          <p>
            Confidence is below 8/10. ICF & MI research demonstrates that commitments under 8 suffer high drop-off.
            What is a smaller or simpler slice of this step that feels like an effortless 9 or 10?
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          <CheckCircle2 size={16} />
          <span>High-conviction threshold met ({confidence}/10). You are primed to execute.</span>
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
        Lock In Commitment & Advance to Session Close
      </button>
    </div>
  );
};
