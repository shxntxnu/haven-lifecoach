import React from 'react';
import { Shield, Calculator, AlertTriangle, BellOff, Bell, Lock } from 'lucide-react';

interface HeaderProps {
  onToggleDisguise: () => void;
  onPanicWipe: () => void;
  quietMode: boolean;
  onToggleQuietMode: () => void;
  onLockVault?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleDisguise,
  onPanicWipe,
  quietMode,
  onToggleQuietMode,
  onLockVault,
}) => {
  return (
    <header className="haven-header">
      <div className="brand-section">
        <div className="brand-logo" title="Haven AI Companion">
          <Shield size={20} />
        </div>
        <div className="brand-info">
          <h1>
            Haven
            <span className="zk-badge">100% Private & Safe</span>
          </h1>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="icon-btn"
          onClick={onToggleQuietMode}
          title={quietMode ? 'Quiet Mode (Muted)' : 'Mute Notifications'}
          aria-label="Toggle Quiet Mode"
        >
          {quietMode ? <BellOff size={18} color="#34d399" /> : <Bell size={18} />}
        </button>

        <button
          className="icon-btn"
          onClick={onToggleDisguise}
          title="Disguise as Calculator"
          aria-label="Disguise as Calculator"
        >
          <Calculator size={18} />
        </button>

        {onLockVault && (
          <button
            className="icon-btn"
            onClick={onLockVault}
            title="Lock My Safe Space"
            aria-label="Lock My Safe Space"
          >
            <Lock size={18} />
          </button>
        )}

        <button
          className="icon-btn danger"
          onClick={onPanicWipe}
          title="Quick Erase (Erase everything right now)"
          aria-label="Quick Erase"
        >
          <AlertTriangle size={18} />
        </button>
      </div>
    </header>
  );
};
