// components/ModelSelector.tsx
import { MODEL_CONFIGS, LumaModel, LumaImageModel, LumaVideoModel } from '@/types/luma';

interface ModelSelectorProps {
  selectedModel: LumaModel;
  onModelSelect: (model: LumaModel) => void;
  disabled?: boolean;
}

const ModelSelector = ({ selectedModel, onModelSelect, disabled }: ModelSelectorProps) => {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-300">
        Choose Model
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(MODEL_CONFIGS).map(([model, config]) => (
          <button
            key={model}
            type="button"
            onClick={() => onModelSelect(model as LumaModel)}
            disabled={disabled}
            className={`
              p-4 rounded-lg border transition-colors text-left
              ${selectedModel === model 
                ? 'bg-purple-900/50 border-purple-500' 
                : 'bg-[#2a2a2a] border-gray-700 hover:border-purple-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="font-medium">{config.name}</div>
            <div className="text-sm text-gray-400 mt-1">{config.description}</div>
            <div className="text-xs text-gray-500 mt-2">
              {config.features.join(' • ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;
