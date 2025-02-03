// components/AdvancedControls.tsx
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { GenerationOptions, LumaModel } from '@/types/luma';

interface AdvancedControlsProps {
  options: GenerationOptions;
  onChange: (updates: Partial<GenerationOptions>) => void;
  disabled?: boolean;
}

const AdvancedControls: React.FC<AdvancedControlsProps> = ({
  options,
  onChange,
  disabled
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Loop Video</label>
          <Switch
            checked={options.loop}
            onCheckedChange={(checked) => onChange({ loop: checked })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Aspect Ratio
          </label>
          <select
            value={options.aspectRatio}
            onChange={(e) => onChange({ aspectRatio: e.target.value })}
            disabled={disabled}
            className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Camera Motion
          </label>
          <select
            value={options.cameraMotion.type}
            onChange={(e) => onChange({
              cameraMotion: {
                ...options.cameraMotion,
                type: e.target.value as any
              }
            })}
            disabled={disabled}
            className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
          >
            <option value="static">Static</option>
            <option value="orbit">Orbit</option>
            <option value="dolly">Dolly</option>
            <option value="pan">Pan</option>
            <option value="tilt">Tilt</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Resolution
          </label>
          <select
            value={`${options.resolution.width}x${options.resolution.height}`}
            onChange={(e) => {
              const [width, height] = e.target.value.split('x').map(Number);
              onChange({ resolution: { width, height } });
            }}
            disabled={disabled}
            className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
          >
            <option value="1920x1080">1920x1080 (Full HD)</option>
            <option value="1280x720">1280x720 (HD)</option>
            <option value="854x480">854x480 (SD)</option>
          </select>
        </div>

        {options.cameraMotion.type !== 'static' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Camera Direction
            </label>
            <select
              value={options.cameraMotion.direction}
              onChange={(e) => onChange({
                cameraMotion: {
                  ...options.cameraMotion,
                  direction: e.target.value as any
                }
              })}
              disabled={disabled}
              className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Camera Speed
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={options.cameraMotion.speed}
            onChange={(e) => onChange({
              cameraMotion: {
                ...options.cameraMotion,
                speed: Number(e.target.value)
              }
            })}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedControls;
