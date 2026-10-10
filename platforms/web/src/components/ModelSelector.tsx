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
        <span>Local Execution:</span>
        <select
          id="model-selector-dropdown"
          className="model-dropdown-select"
          value={selectedModelId}
          onChange={(e) => onSelectModel(e.target.value)}
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} — {model.contextWindow} {model.recommended ? '★ (Recommended: Zero Context Loss)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="model-pill" title={current.description}>
        <Sparkles size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
        {current.tag}
      </div>
    </section>
  );
};
