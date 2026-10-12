import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { AVAILABLE_MODELS } from '../engine';

interface ModelSelectorProps {
  selectedModelId: string;
  onSelectModel: (id: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onSelectModel,
}) => {
  const current = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  return (
    <section className="model-selector-bar" aria-label="Local Model Selection">
      <div className="model-selector-left">
        <Cpu size={16} color="#14b8a6" />
        <span>How Haven Thinks:</span>
        <select
          id="model-selector-dropdown"
          className="model-dropdown-select"
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
        >
          <option value="llama-3.2-3b-128k">
            Llama-3.2-3B — Remembers All Your Chats ★ (Recommended)
          </option>
          <option value="llama-3.2-1b-128k">
            Llama-3.2-1B — Light & Quick
          </option>
          <option value="phi-3.5-mini-128k">
            Phi-3.5-mini — Deep Thinker
          </option>
          <option value="simulated-airgap">
            Instant Offline — Always Ready (No Download)
          </option>
        </select>
      </div>
      <div className="model-pill" title={current.description}>
        <Sparkles size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
        {current.tag}
      </div>
    </section>
  );
};
