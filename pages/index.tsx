import { useState, useEffect } from 'react';
import Head from 'next/head';

interface NostrWindow extends Window {
  nostr?: {
    getPublicKey(): Promise<string>;
    signEvent(event: any): Promise<any>;
  };
}

interface StoredGeneration {
  id: string;
  prompt: string;
  videoUrl?: string;
  state: string;
  createdAt: string;
  pubkey: string;
}

const getNostrPublicKey = async () => {
  const win = window as NostrWindow;
  if (!win.nostr) {
    throw new Error('Nostr extension not found. Please install a NIP-07 browser extension.');
  }
  return await win.nostr.getPublicKey();
};

const saveGeneration = (generation: StoredGeneration) => {
  const generations = getGenerations();
  generations.unshift(generation);
  localStorage.setItem('generations', JSON.stringify(generations));
};

const getGenerations = (): StoredGeneration[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('generations');
  return stored ? JSON.parse(stored) : [];
};

const getStatusMessage = (state: string) => {
  switch (state) {
    case 'queued':
      return 'Preparing to generate your video...';
    case 'dreaming':
    case 'processing':
      return 'Creating your masterpiece...';
    case 'completed':
      return 'Video ready!';
    case 'failed':
      return 'Generation failed';
    default:
      return 'Processing...';
  }
};

export default function Home() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<StoredGeneration[]>([]);
  const [error, setError] = useState('');
  const [selectedGeneration, setSelectedGeneration] = useState<StoredGeneration | null>(null);

  useEffect(() => {
    if (pubkey) {
      const stored = getGenerations().filter(g => g.pubkey === pubkey);
      setGenerations(stored);
    }
  }, [pubkey]);

  const connectNostr = async () => {
    try {
      const key = await getNostrPublicKey();
      setPubkey(key);
    } catch (err) {
      setError('Failed to connect Nostr. Please install a NIP-07 extension like Alby.');
    }
  };

  const generateVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt || !pubkey) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('Generating video with prompt:', prompt);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate video');
      }
      
      const data = await response.json();
      console.log('Generation response:', data);
      
      if (!data.id) {
        throw new Error('Invalid response from server');
      }
      
      const newGeneration = {
        id: data.id,
        prompt,
        state: data.state || 'queued',
        createdAt: data.created_at || new Date().toISOString(),
        pubkey,
        videoUrl: data.assets?.video
      };
      
      saveGeneration(newGeneration);
      setGenerations(prev => [newGeneration, ...prev]);
      setSelectedGeneration(newGeneration);
      setPrompt('');
      pollForCompletion(data.id);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pollForCompletion = async (id: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/check-status?id=${id}`);
        if (!response.ok) {
          throw new Error('Failed to check status');
        }
        
        const data = await response.json();
        console.log('Status check response:', data);

        const updatedGeneration = {
          ...generations.find(g => g.id === id)!,
          state: data.state,
          videoUrl: data.assets?.video
        };
        
        setGenerations(prev => 
          prev.map(g => g.id === id ? updatedGeneration : g)
        );
        
        if (selectedGeneration?.id === id) {
          setSelectedGeneration(updatedGeneration);
        }

        // Update in storage
        const stored = getGenerations();
        const updated = stored.map(g => g.id === id ? updatedGeneration : g);
        localStorage.setItem('generations', JSON.stringify(updated));

        if (data.state === 'completed' || data.state === 'failed') {
          return true; // Stop polling
        }
        return false; // Continue polling
      } catch (err) {
        console.error('Error checking status:', err);
        return true; // Stop polling on error
      }
    };

    const poll = async () => {
      const shouldStop = await checkStatus();
      if (!shouldStop) {
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  if (!pubkey) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
        <div className="max-w-md w-full p-6 space-y-6">
          <h1 className="text-3xl font-bold text-center">Luma AI Video Generator</h1>
          <div className="bg-[#1a1a1a] p-8 rounded-lg shadow-xl space-y-4">
            <p className="text-gray-300 text-center">Connect your Nostr wallet to get started</p>
            <button
              onClick={connectNostr}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              Connect with Nostr
            </button>
            {error && (
              <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Luma AI Video Generator</title>
      </Head>

      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-[#1a1a1a] border-r border-gray-800 hidden md:block overflow-auto">
          <div className="p-4">
            <h2 className="text-xl font-bold mb-4">History</h2>
            <div className="space-y-2">
              {generations.map((gen) => (
                <button
                  key={gen.id}
                  onClick={() => setSelectedGeneration(gen)}
                  className={`w-full text-left p-3 rounded-lg transition duration-200 ${
                    selectedGeneration?.id === gen.id 
                      ? 'bg-purple-600' 
                      : 'hover:bg-[#2a2a2a]'
                  }`}
                >
                  <p className="text-sm font-medium truncate">{gen.prompt}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(gen.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-[#1a1a1a] border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Luma AI Video Generator</h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">
                  {pubkey.slice(0, 8)}...{pubkey.slice(-8)}
                </span>
                <button
                  onClick={() => setPubkey(null)}
                  className="text-sm text-gray-400 hover:text-white transition duration-200"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </header>

          {/* Main area */}
          <div className="flex-1 overflow-auto">
            {selectedGeneration ? (
              <div className="p-6">
                <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedGeneration.prompt}</h2>
                      <p className="text-sm text-gray-400 mt-1">
                        {new Date(selectedGeneration.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedGeneration(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-800 pt-4">
                    <p className="text-sm text-gray-300 mb-4">
                      {getStatusMessage(selectedGeneration.state)}
                    </p>
                    
                    {selectedGeneration.videoUrl ? (
                      <div className="space-y-4">
                        <video
                          className="w-full rounded-lg"
                          controls
                          src={selectedGeneration.videoUrl}
                          loop
                        />
                        <a
                          href={selectedGeneration.videoUrl}
                          download
                          className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                        >
                          Download Video
                        </a>
                      </div>
                    ) : selectedGeneration.state === 'failed' ? (
                      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                        Generation failed. Please try again.
                      </div>
                    ) : (
                      <div className="animate-pulse space-y-4">
                        <div className="h-64 bg-[#2a2a2a] rounded-lg"></div>
                        <div className="h-4 bg-[#2a2a2a] rounded w-3/4"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="max-w-3xl mx-auto">
                  <form 
                    onSubmit={generateVideo}
                    className="bg-[#1a1a1a] rounded-lg p-6 space-y-4"
                    id="generation-form"
                  >
                    <textarea
                      id="prompt-input"
                      name="prompt"
                      className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your video idea..."
                      disabled={loading}
                      aria-label="Video prompt"
                    />
                    
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading || !prompt}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
                      >
                        {loading ? (
                          <span className="flex items-center space-x-2">
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Generating...</span>
                          </span>
                        ) : (
                          'Generate Video'
                        )}
                      </button>
                    </div>

                    {error && (
                      <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                        <p className="font-medium">Error</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
