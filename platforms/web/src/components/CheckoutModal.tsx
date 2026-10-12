import React, { useState } from 'react';
import { CheckCircle, ThumbsUp, ThumbsDown } from 'lucide-react';

interface CheckoutModalProps {
  onComplete: (score: number, helpful: boolean) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onComplete }) => {
  const [selectedScore, setSelectedScore] = useState<number>(5);
  const [helpful, setHelpful] = useState<boolean>(true);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="checkout-modal">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(20, 184, 166, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={24} color="#14b8a6" />
          </div>
        </div>

        <h2 id="checkout-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#f8fafc', marginBottom: '0.5rem' }}>
          Resting & Wrapping Up
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          How did talking things through feel for your heart today?
        </p>

        <div className="score-selector">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              className={`score-btn ${selectedScore === score ? 'active' : ''}`}
              onClick={() => setSelectedScore(score)}
              aria-label={`Score ${score}`}
            >
              {score}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '-1rem', marginBottom: '1rem', padding: '0 0.5rem' }}>
          <span>1 = Felt Hard</span>
          <span>5 = Felt Safe & Wonderful</span>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', padding: '0.85rem', margin: '1rem 0' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
            Did the way I listened feel comforting and helpful?
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button
              className={`icon-btn ${helpful ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                gap: '0.5rem',
                borderColor: helpful ? '#14b8a6' : 'rgba(255, 255, 255, 0.1)',
                background: helpful ? 'rgba(20, 184, 166, 0.2)' : 'transparent',
                color: helpful ? '#5eead4' : '#94a3b8',
              }}
              onClick={() => setHelpful(true)}
            >
              <ThumbsUp size={16} /> Felt Gentle & Good
            </button>
            <button
              className={`icon-btn ${!helpful ? 'active' : ''}`}
              style={{
                padding: '0.5rem 1rem',
                gap: '0.5rem',
                borderColor: !helpful ? '#f43f5e' : 'rgba(255, 255, 255, 0.1)',
                background: !helpful ? 'rgba(244, 63, 94, 0.2)' : 'transparent',
                color: !helpful ? '#fda4af' : '#94a3b8',
              }}
              onClick={() => setHelpful(false)}
            >
              <ThumbsDown size={16} /> Needed a Softer Way
            </button>
          </div>
        </div>

        <button
          className="close-session-btn"
          onClick={() => onComplete(selectedScore, helpful)}
        >
          Keep Safe in My Private Sanctuary
        </button>
      </div>
    </div>
  );
};
