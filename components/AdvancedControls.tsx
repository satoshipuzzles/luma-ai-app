// components/AdvancedControls.tsx
import { Switch } from "@/components/ui/switch";
import { 
  AspectRatio, 
  CameraMotion, 
  CameraDirection,
  GenerationOptions 
} from '@/types/luma';

interface AdvancedControlsProps {
  options: GenerationOptions;
  onChange: (options: Partial<GenerationOptions>) => void;
  disabled?: boolean;
}

export const AdvancedControls = ({
  options,
  onChange,
  disabled
}: AdvancedControlsProps) => {
  const aspectRatios: AspectRatio[] = ['16:9', '1:1', '9:16', '4:3', '3:4'];
  const cameraMotions: CameraMotion[] = ['static', 'orbit', 'dolly', 'pan', 'tilt'];
  const directions: CameraDirection[] = ['left', 'right', 'up', 'down'];

  return (
    <div className="space-y-6">
      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Aspect Ratio
        </label>
        <div className="flex flex-wrap gap-2">
          {aspectRatios.map((ratio) => (
            <button
              key={ratio}
              onClick={() => onChange({ aspectRatio: ratio })}
              disabled={disabled}
              className={`
                px-3 py-1 rounded-lg text-sm
                ${options.aspectRatio === ratio
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Loop Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">Loop Video</label>
        <Switch
          checked={options.loop}
          onCheckedChange={(checked) => onChange({ loop: checked })}
          disabled={disabled}
        />
      </div>

      {/* Camera Motion */}
      {options.model.startsWith('ray') && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Camera Motion
            </label>
            <select
              value={options.cameraMotion?.type || 'static'}
              onChange={(e) => onChange({
                cameraMotion: {
                  ...options.cameraMotion,
                  type: e.target.value as CameraMotion
                }
              })}
              disabled={disabled}
              className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700"
            >
              {cameraMotions.map((motion) => (
                <option key={motion} value={motion}>
                  {motion.charAt(0).toUpperCase() + motion.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {options.cameraMotion?.type !== 'static' && (
            <>
              {/* Camera Direction */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Camera Direction
                </label>
                <select
                  value={options.cameraMotion?.direction || 'right'}
                  onChange={(e) => onChange({
                    cameraMotion: {
                      ...options.cameraMotion,
                      direction: e.target.value as CameraDirection
                    }
                  })}
                  disabled={disabled}
                  className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700"
                >
                  {directions.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction.charAt(0).toUpperCase() + direction.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Speed */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Camera Speed
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={options.cameraMotion?.speed || 1}
                  onChange={(e) => onChange({
                    cameraMotion: {
                      ...options.cameraMotion,
                      speed: parseFloat(e.target.value)
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
            </>
          )}
        </>
      )}

      {/* Duration (for video models) */}
      {options.model.startsWith('ray') && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Duration (seconds)
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={options.duration || 4}
            onChange={(e) => onChange({ duration: parseInt(e.target.value) })}
            disabled={disabled}
            className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700"
          />
        </div>
      )}

      {/* Resolution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Width
          </label>
          <input
            type="number"
            min="256"
            max="2048"
            step="64"
            value={options.resolution?.width || 1920}
            onChange={(e) => onChange({
              resolution: {
                ...options.resolution,
                width: parseInt(e.target.value)
              }
            })}
            disabled={disabled}
            className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Height
          </label>
          <input
            type="number"
            min="256"
            max="2048"
            step="64"
            value={options.resolution?.height || 1080}
            onChange={(e) => onChange({
              resolution: {
                ...options.resolution,
                height: parseInt(e.target.value)
              }
            })}
            disabled={disabled}
            className="w-full bg-[#2a2a2a] rounded-lg px-3 py-2 text-sm border border-gray-700"
          />
        </div>
      </div>
    </div>
  );
};

export default AdvancedControls;
