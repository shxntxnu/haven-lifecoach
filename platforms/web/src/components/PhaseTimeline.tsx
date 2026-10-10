import React from 'react';
import { OperatingMode, SessionPhase } from '../types';
import { Compass } from 'lucide-react';

interface PhaseTimelineProps {
  currentPhase: SessionPhase;
  operatingMode: OperatingMode;
}

const PHASES: { id: SessionPhase; label: string; index: number }[] = [
  { id: 'Contract', label: '1. Contract', index: 1 },
  { id: 'CheckIn', label: '2. Check-In', index: 2 },
  { id: 'Focus', label: '3. Focus', index: 3 },
  { id: 'Explore', label: '4. Explore', index: 4 },
  { id: 'Options', label: '5. Options', index: 5 },
  { id: 'Commit', label: '6. Commit', index: 6 },
  { id: 'Close', label: '7. Close', index: 7 },
];

export const PhaseTimeline: React.FC<PhaseTimelineProps> = ({
  currentPhase,
  operatingMode,
}) => {
  const currentIndex = PHASES.find((p) => p.id === currentPhase)?.index || 1;

  const modeClass = operatingMode.toLowerCase();

  return (
    <div className="phase-stepper-container">
      <div className="stepper-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
          <Compass size={16} color="#14b8a6" />
          <span>7-Phase ICF Journey</span>
        </div>
        <div className={`mode-badge ${modeClass}`}>
          Mode: {operatingMode}
        </div>
      </div>

      <div className="stepper-track">
        {PHASES.map((p) => {
          const isActive = p.id === currentPhase;
          const isCompleted = p.index < currentIndex;

          return (
            <div
              key={p.id}
              className={`step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="step-circle">
                {isCompleted ? '✓' : p.index}
              </div>
              <span className="step-label">{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
