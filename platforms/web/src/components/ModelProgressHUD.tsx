import React from 'react';
import { WebLLMProgress } from '../webllm';
import { Cpu, Download, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface ModelProgressHUDProps {
  modelName: string;
  progress: WebLLMProgress;
  onInitialize: () => void;
  onFallbackToSim: () => void;
}

export const ModelProgressHUD: React.FC<ModelProgressHUDProps> = ({
  modelName,
  progress,
  onInitialize,
  onFallbackToSim,
}) => {
  const percent = Math.round(progress.progress * 100);

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(20, 184, 166, 0.25)',
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={16} color="#14b8a6" />
          <span style={{ fontWeight: 600, color: '#f1f5f9' }}>WebGPU Engine: {modelName}</span>
        </div>

        {progress.isLoaded ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontSize: '0.75rem' }}>
            <CheckCircle2 size={14} /> Ready in VRAM
          </span>
        ) : progress.isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8', fontSize: '0.75rem' }}>
            <RefreshCw size={14} className="spin" /> Compiling ({percent}%)
          </span>
        ) : (
          <button
            onClick={onInitialize}
            style={{
              background: '#0d9488',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Download size={13} /> Load WebGPU Weights
          </button>
        )}
      </div>

      {progress.isLoading && (
        <div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden', margin: '0.4rem 0' }}>
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0d9488, #2dd4bf)',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{progress.text}</div>
        </div>
      )}

      {progress.error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', color: '#fca5a5', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertCircle size={14} /> {progress.error}
          </span>
          <button
            onClick={onFallbackToSim}
            style={{
              background: 'none',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fda4af',
              borderRadius: '4px',
              padding: '0.15rem 0.45rem',
              cursor: 'pointer',
              fontSize: '0.7rem',
            }}
          >
            Switch to Instant Simulation
          </button>
        </div>
      )}
    </div>
  );
};
