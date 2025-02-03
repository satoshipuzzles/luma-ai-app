// components/ModelSelector.tsx
import { MODEL_CONFIGS, LumaModel, LumaImageModel } from '@/types/luma';

interface ModelSelectorProps {
  selectedModel: LumaModel | LumaImageModel;
  onModelSelect: (model: LumaModel | LumaImageModel) => void;
  disabled?: boolean;
}

export const ModelSelector = ({
  selectedModel,
  onModelSelect,
  disabled
}: ModelSelectorProps) => {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-300">
        Select Model
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(MODEL_CONFIGS).map(([modelId, config]) => (
          <button
            key={modelId}
            onClick={() => onModelSelect(modelId as LumaModel | LumaImageModel)}
            disabled={disabled}
            className={`
              p-4 rounded-lg border transition-colors text-left
              ${selectedModel === modelId
                ? 'border-purple-500 bg-purple-900/20'
                : 'border-gray-700 hover:border-gray-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <h3 className="font-medium mb-1">{config.name}</h3>
            <p className="text-sm text-gray-400 mb-2">{config.description}</p>
            <ul className="text-xs text-gray-500 space-y-1">
              {config.features.map((feature, index) => (
                <li key={index}>• {feature}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;
