import React, { useState } from 'react';
import { Sunrise, Sun, Sunset, Moon, Sparkles, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { Header } from './Header';

interface WelcomePageProps {
  onCheckIn: () => void;
  onToggleDisguise: () => void;
  onPanicWipe: () => void;
  quietMode: boolean;
  onToggleQuietMode: () => void;
  onLockVault: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({
  onCheckIn,
  onToggleDisguise,
  onPanicWipe,
  quietMode,
  onToggleQuietMode,
  onLockVault,
}) => {
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  // Determine current time period and friendly greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  let timeIcon = <Sunset size={38} color="#f97316" />;
  let periodColor = 'rgba(249, 115, 22, 0.15)';

  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning';
    timeIcon = <Sunrise size={38} color="#fbbf24" />;
    periodColor = 'rgba(251, 191, 36, 0.15)';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
    timeIcon = <Sun size={38} color="#f59e0b" />;
    periodColor = 'rgba(245, 158, 11, 0.15)';
  } else if (hour >= 17 && hour < 22) {
    greeting = 'Good evening';
    timeIcon = <Sunset size={38} color="#f97316" />;
    periodColor = 'rgba(249, 115, 22, 0.15)';
  } else {
    greeting = 'Good evening';
    timeIcon = <Moon size={38} color="#818cf8" />;
    periodColor = 'rgba(129, 140, 248, 0.15)';
  }

  const handleStartCheckIn = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      onCheckIn();
    }, 400);
  };

  return (
    <div className={`welcome-screen ${isTransitioning ? 'fade-out' : ''}`}>
      <Header
        onToggleDisguise={onToggleDisguise}
        onPanicWipe={onPanicWipe}
        quietMode={quietMode}
        onToggleQuietMode={onToggleQuietMode}
        onLockVault={onLockVault}
      />

      <div className="welcome-hero-card">
        <div className="welcome-glow-orb" style={{ background: periodColor }} />

        <div className="welcome-icon-circle" style={{ background: periodColor }}>
          {timeIcon}
        </div>

        <div className="welcome-badge">
          <Sparkles size={14} color="#14b8a6" />
          <span>Your Private Sanctuary</span>
        </div>

        <h1 className="welcome-heading">{greeting}</h1>

        <p className="welcome-subtext">
          Take a gentle, slow breath. Everything here is safe, private, and completely unjudged. Whenever you feel ready, we can check in together.
        </p>

        <div className="welcome-features">
          <div className="welcome-feature-item">
            <ShieldCheck size={16} color="#14b8a6" />
            <span>100% On-Device & Private</span>
          </div>
          <div className="welcome-feature-item">
            <Heart size={16} color="#f43f5e" />
            <span>Zero pressure, at your pace</span>
          </div>
        </div>

        <button
          className="welcome-checkin-btn"
          onClick={handleStartCheckIn}
          disabled={isTransitioning}
          aria-label="Ready to check in"
        >
          <span>Ready to check in</span>
          <ArrowRight size={18} className="arrow-icon" />
        </button>
      </div>
    </div>
  );
};
