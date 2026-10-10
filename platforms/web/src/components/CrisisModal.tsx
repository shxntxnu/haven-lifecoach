import React from 'react';
import { AlertOctagon, PhoneCall, Heart } from 'lucide-react';
import { CRISIS_RESOURCES } from '../engine';

interface CrisisModalProps {
  matchedCategory?: string;
  onAcknowledge: () => void;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({
  matchedCategory,
  onAcknowledge,
}) => {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="crisis-title">
      <div className="crisis-card">
        <div className="crisis-header">
          <AlertOctagon size={28} />
          <h2 id="crisis-title">We Care Deeply About Your Safety</h2>
        </div>

        <p style={{ color: '#fda4af', marginBottom: '1rem', lineHeight: 1.5 }}>
          Haven is an automated coaching tool and is strictly not equipped to handle acute distress or medical crises.
          Your life and safety are the absolute top priority. Coaching is paused so you can connect with humans trained to support you right now.
        </p>

        {matchedCategory && (
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
            Flagged trigger: <strong style={{ color: '#f43f5e' }}>{matchedCategory}</strong>
          </div>
        )}

        <div className="helpline-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <PhoneCall size={16} />
            <span>Confidential, Free 24/7 Lifelines</span>
          </div>

          {CRISIS_RESOURCES.map((r, i) => (
            <div key={i} className="helpline-item">
              <span style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{r.region} ({r.name})</span>
              <span className="helpline-number">{r.number}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.8rem', margin: '0.8rem 0' }}>
          <Heart size={14} color="#f43f5e" />
          <span>You do not have to carry this alone. Please reach out to one of the numbers above.</span>
        </div>

        <button
          className="send-btn"
          style={{
            width: '100%',
            background: '#e11d48',
            color: '#ffffff',
            justifyContent: 'center',
            marginTop: '0.5rem',
          }}
          onClick={onAcknowledge}
        >
          I Understand & Will Seek Direct Support
        </button>
      </div>
    </div>
  );
};
