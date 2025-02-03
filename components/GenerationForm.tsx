// components/GenerationForm.tsx
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { GenerationOptions } from '@/types/luma';
import ModelSelector from './ModelSelector';
import AdvancedControls from './AdvancedControls';
import { toast } from "@/components/ui/use-toast";

interface GenerationFormProps {
  onGenerate: (options: GenerationOptions) => Promise<void>;
  loading: boolean;
}

export const GenerationForm = ({ onGenerate, loading }: GenerationFormProps) => {
  const [options, setOptions] = useState<GenerationOptions>({
    model: 'ray-2',
    prompt: '',
    aspectRatio: '16:9',
    loop: true,
    resolution: {
      width: 1920,
      height: 1080
    },
    cameraMotion: {
      type: 'static',
      speed: 1,
      direction: 'right'
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!options.prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a prompt"
      });
      return;
    }
    await onGenerate(options);
  };

  const updateOptions = (updates: Partial<GenerationOptions>) => {
    setOptions(prev => ({ ...prev, ...updates }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Model Selection */}
      <ModelSelector
        selectedModel={options.model}
        onModelSelect={(model) => updateOptions({ model })}
        disabled={loading}
      />

      {/* Prompt Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Describe your video/image
        </label>
        <textarea
          value={options.prompt}
          onChange={(e) => updateOptions({ prompt: e.target.value })}
          disabled={loading}
          className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
          rows={4}
          placeholder="Enter your prompt..."
        />
      </div>

      {/* Advanced Controls */}
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-medium mb-4">Advanced Settings</h3>
        <AdvancedControls
          options={options}
          onChange={updateOptions}
          disabled={loading}
        />
      </div>

      {/* Generate Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || !options.prompt.trim()}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin h-5 w-5" />
              <span>Generating...</span>
            </>
          ) : (
            <span>Generate</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default GenerationForm;
