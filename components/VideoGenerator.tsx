// components/VideoGenerator.tsx
import { useState, useEffect } from 'react';
import { 
  Upload, 
  RefreshCw, 
  X, 
  Zap,
  AlertCircle
} from 'lucide-react';
import { toast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { isPromptSafe, getPromptFeedback } from '../lib/profanity';

// Types
type Resolution = '540p' | '720p' | '1080p' | '4k';
type Duration = '3s' | '5s' | '8s' | '10s';

interface Generation {
  id: string;
  prompt: string;
  videoUrl?: string;
  state: string;
  createdAt: string;
  pubkey: string;
}

interface VideoGeneratorProps {
  pubkey: string;
  onGenerationStart: (generation: Generation) => void;
  onError: (error: string) => void;
  generations: Generation[];
  credits: number;
  useCredits: (pubkey: string, amount: number, reason: string) => boolean;
  refundCredits: (pubkey: string, amount: number, reason: string) => number;
  pricing: {
    base: number;
    ray2: Record<Resolution, Record<Duration, number>>;
  }
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({
  pubkey,
  onGenerationStart,
  onError,
  generations,
  credits,
  useCredits,
  refundCredits,
  pricing,
  isLoading,
  setLoading
}) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [useRay2, setUseRay2] = useState<boolean>(true);
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [duration, setDuration] = useState<Duration>("5s");
  const [isLooping, setIsLooping] = useState(true);
  const [startImageUrl, setStartImageUrl] = useState<string | null>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [usingCredits, setUsingCredits] = useState<boolean>(false);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState<boolean>(false);
  const [error, setError] = useState('');

  // Calculate price based on selected options
  const calculatePrice = (): number => {
    if (!useRay2) {
      return pricing.base;
    }
    return pricing.ray2[resolution][duration];
  };

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      setError('');
      
      if (!window.nostr) {
        throw new Error('Nostr extension not found');
      }
      
      if (!pubkey) {
        throw new Error('Not connected to Nostr');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Create proper NIP-98 event
      const event: any = {
        kind: 27235,
        created_at: Math.floor(Date.now() / 1000),
        content: "",
        tags: [
          ["u", "https://nostr.build/api/v2/upload/files"],
          ["method", "POST"],
        ],
        pubkey
      };

      // Get event hash using imported library instead of browser extension
      const hashedEvent = await import('nostr-tools').then(tools => tools.getEventHash(event));
      
      const signedEvent = await window.nostr.signEvent({
        ...event,
        id: hashedEvent
      });

      if (!signedEvent) {
        throw new Error('Failed to sign event');
      }

      // Base64 encode the signed event
      const authToken = btoa(JSON.stringify(signedEvent));

      // Upload to nostr.build with Authorization header
      const response = await fetch('https://nostr.build/api/v2/upload/files', {
        method: 'POST',
        headers: {
          'Authorization': `Nostr ${authToken}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Upload failed: ' + errorText);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        setStartImageUrl(result.data[0].url);
        toast({
          title: "Image uploaded",
          description: "Start image has been set"
        });
        return result.data[0].url;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setError('Failed to upload image. Please try again.');
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again"
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // Generate video
  const generateVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt || !pubkey) return;

    if (!isPromptSafe(prompt)) {
      setError(getPromptFeedback(prompt));
      toast({
        variant: "destructive",
        title: "Invalid prompt",
        description: getPromptFeedback(prompt),
      });
      return;
    }

    setLoading(true);
    setError('');
    
    const price = calculatePrice();
    
    // Check if user has enough credits
    if (credits >= price) {
      // Ask user if they want to use credits
      setShowCreditConfirmation(true);
      return;
    }
    
    // Otherwise, inform user they need to pay
    setLoading(false);
    toast({
      variant: "destructive",
      title: "Insufficient credits",
      description: `You need ${price} credits to generate this video.`,
    });
  };

  // Handle generation with credits
  const handleGenerationWithCredits = async () => {
    setShowCreditConfirmation(false);
    
    const price = calculatePrice();
    if (!useCredits(pubkey, price, 'video-generation')) {
      toast({
        variant: "destructive",
        title: "Insufficient credits",
        description: "Please add more credits to your account.",
      });
      setLoading(false);
      return;
    }
    
    setUsingCredits(true);
    
    try {
      await handleGeneration();
    } catch (err) {
      console.error('Generation with credits failed:', err);
      // Refund the credits on failure
      refundCredits(pubkey, price, 'generation-failed');
      
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate video. Please try again.'
      );
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Please try again",
      });
      setLoading(false);
    } finally {
      setUsingCredits(false);
    }
  };
  
  // Main generation logic
  const handleGeneration = async () => {
    try {
      // Prepare generation request with Ray 2 parameters
      const generationBody: any = { 
        prompt,
        loop: isLooping,
        useRay2: useRay2,
        resolution: useRay2 ? resolution : undefined,
        duration: useRay2 ? duration : undefined
      };

      if (isExtending && selectedVideoId) {
        generationBody.extend = true;
        generationBody.videoId = selectedVideoId;
      } else if (startImageUrl) {
        generationBody.startImageUrl = startImageUrl;
      }

      console.log('Sending generation request with body:', JSON.stringify(generationBody));

      // Generate video
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generationBody),
      });

      console.log('Generation response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate video');
      }

      const data = await response.json();
      console.log('Generation response data:', data);

      if (!data.id) {
        throw new Error('Invalid response from server: no generation ID');
      }

      const newGeneration: Generation = {
        id: data.id,
        prompt,
        state: data.state || 'queued',
        createdAt: data.created_at || new Date().toISOString(),
        pubkey: pubkey,
        videoUrl: data.assets?.video,
      };

      onGenerationStart(newGeneration);
      setPrompt('');

      toast({
        title: "Generation started",
        description: "Your video is being generated",
      });
      
      return newGeneration;
    } catch (err) {
      console.error('Generation error:', err);
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to generate video. Please try again.';
      
      onError(errorMessage);
      throw err;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form
        onSubmit={generateVideo}
        className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 space-y-4"
      >
        <textarea
          id="prompt-input"
          name="prompt"
          className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your video idea..."
          disabled={isLoading}
        />

        {/* Video Options */}
        <div className="space-y-4">
          {/* Ray 2 Model Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Use Ray 2 Model</label>
            <Switch
              checked={useRay2}
              onCheckedChange={setUseRay2}
              disabled={isLoading}
            />
          </div>

          {/* Ray 2 Options (only show when Ray 2 is enabled) */}
          {useRay2 && (
            <>
              {/* Resolution Selector */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Resolution
                </label>
                <select
                  className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as Resolution)}
                  disabled={isLoading}
                >
                  <option value="540p">540p</option>
                  <option value="720p">720p (Recommended)</option>
                  <option value="1080p">1080p</option>
                  <option value="4k">4K</option>
                </select>
              </div>

              {/* Duration Selector */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Duration
                </label>
                <select
                  className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as Duration)}
                  disabled={isLoading}
                >
                  <option value="3s">3 seconds</option>
                  <option value="5s">5 seconds (Recommended)</option>
                  <option value="8s">8 seconds</option>
                  <option value="10s">10 seconds</option>
                </select>
              </div>
            </>
          )}

          {/* Loop Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Loop Video</label>
            <Switch
              checked={isLooping}
              onCheckedChange={setIsLooping}
              disabled={isLoading}
            />
          </div>

          {/* Extend Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">Extend Previous Video</label>
            <Switch
              checked={isExtending}
              onCheckedChange={(checked) => { 
                setIsExtending(checked); 
                if (checked) setStartImageUrl(null);
              }}
              disabled={isLoading}
            />
          </div>

          {/* Conditional Content */}
          {isExtending ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Select Video to Extend
              </label>
              <select
                className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-2 text-white"
                value={selectedVideoId || ''}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Select a video...</option>
                {generations
                  .filter(g => g.state === 'completed')
                  .map((gen) => (
                    <option key={gen.id} value={gen.id}>
                      {gen.prompt}
                    </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Image (Optional)
              </label>
              <div className="flex items-center gap-4">
                <label className="flex-1">
                  <div className={`
                    flex items-center justify-center w-full h-32 
                    border-2 border-dashed border-gray-700 rounded-lg 
                    cursor-pointer hover:border-purple-500
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}>
                    {startImageUrl ? (
                      <div className="relative w-full h-full">
                        <img
                          src={startImageUrl}
                          alt="Start frame"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setStartImageUrl(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload size={24} className="text-gray-500" />
                        <span className="mt-2 text-sm text-gray-500">
                          {uploadingImage ? 'Uploading...' : 'Click to upload start image'}
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                    disabled={isLoading}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Price display */}
        <div className="flex justify-between items-center p-3 bg-[#2a2a2a] rounded-lg">
          <div>
            <span className="text-gray-400">Price: </span>
            <span className="font-bold text-white">{calculatePrice()} sats</span>
          </div>
          
          {credits > 0 && (
            <div className="text-sm text-gray-300">
              <span className="font-medium text-purple-400">{credits} sats</span> available in credits
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !prompt || (isExtending && !selectedVideoId)}
            className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
          >
            {isLoading ? (
              <span className="flex items-center space-x-2">
                <RefreshCw className="animate-spin h-5 w-5" />
                <span>Generating...</span>
              </span>
            ) : (
              'Generate Video'
            )}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </form>

      {/* Credit Usage Confirmation Modal */}
      {showCreditConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-[#1a1a1a] p-4 md:p-6 rounded-lg space-y-4 max-w-sm w-full">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Use Credits</h2>
              <button
                onClick={() => {
                  setShowCreditConfirmation(false);
                  setLoading(false);
                }}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-gray-300">
              You have <span className="font-bold text-purple-400">{credits} sats</span> in credits.
              Would you like to use <span className="font-bold text-purple-400">{calculatePrice()} sats</span> to generate this video?
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowCreditConfirmation(false);
                  setLoading(false);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerationWithCredits}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
              >
                <Zap className="mr-2 h-4 w-4" />
                Use Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGenerator;
