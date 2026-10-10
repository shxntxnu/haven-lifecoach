import React, { useState } from 'react';
import { Shield, Lock, KeyRound } from 'lucide-react';

interface VaultAuthModalProps {
  onUnlockMaster: () => void;
  onUnlockDecoy: () => void;
  onClose?: () => void;
}

export const VaultAuthModal: React.FC<VaultAuthModalProps> = ({
  onUnlockMaster,
  onUnlockDecoy,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (pin === '1234') {
      onUnlockMaster();
    } else if (pin === '0000') {
      onUnlockDecoy();
    } else {
      setError('Invalid PIN code');
      setPin('');
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vault-auth-title">
      <div className="checkout-modal" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(20, 184, 166, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={26} color="#14b8a6" />
          </div>
        </div>

        <h2 id="vault-auth-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#f8fafc', marginBottom: '0.35rem' }}>
          Sanctuary Vault Lock
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Enter your 4-digit security PIN to unseal your encrypted session.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            placeholder="••••"
            style={{
              width: '180px',
              margin: '0 auto 1rem',
              textAlign: 'center',
              fontSize: '1.8rem',
              letterSpacing: '0.4em',
              background: '#0a101c',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              color: '#ffffff',
              padding: '0.5rem',
              outline: 'none',
              display: 'block',
            }}
            autoFocus
          />

          {error && <div style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</div>}

          <button
            type="submit"
            className="send-btn"
            style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
          >
            <Lock size={16} /> Unseal Vault
          </button>
        </form>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem', fontSize: '0.75rem', color: '#64748b' }}>
          <div style={{ marginBottom: '0.5rem', color: '#94a3b8' }}>
            <KeyRound size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            Plausible Deniability Stealth Pins:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setPin('1234');
                onUnlockMaster();
              }}
              style={{
                background: 'rgba(20, 184, 166, 0.1)',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                color: '#2dd4bf',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Master PIN (1234)
            </button>
            <button
              onClick={() => {
                setPin('0000');
                onUnlockDecoy();
              }}
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fbbf24',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Decoy PIN (0000)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
