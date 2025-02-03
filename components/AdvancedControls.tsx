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

  const handleCameraMotionChange = (type: CameraMotion) => {
    const newCameraMotion = {
      type,
      speed: options.cameraMotion?.speed || 1,
      direction: options.cameraMotion?.direction || 'right'
    };
    
    onChange({ cameraMotion: newCameraMotion });
  };

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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Camera Motion
        </label>
        <select
          value={options.cameraMotion?.type || 'static'}
          onChange={(e) => handleCameraMotionChange(e.target.value as CameraMotion)}
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

      {/* Additional camera controls when not static */}
      {options.cameraMotion?.type !== 'static' && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Direction
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Speed
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
    </div>
  );
};

export default AdvancedControls;
