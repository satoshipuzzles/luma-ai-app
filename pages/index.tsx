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
  const stored = localStorage.getItem('generations');
  return stored ? JSON.parse(stored) : [];
};

export default function Home() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<StoredGeneration[]>([]);
  const [error, setError] = useState('');

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

  const generateVideo = async () => {
    if (!prompt || !pubkey) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate video');
      }
      
      const data = await response.json();
      
      // Save to local storage
      const newGeneration = {
        id: data.id,
        prompt,
        state: data.state,
        createdAt: new Date().toISOString(),
        pubkey,
        videoUrl: data.assets?.video
      };
      
      saveGeneration(newGeneration);
      setGenerations(prev => [newGeneration, ...prev]);

      // Start polling for this generation
      pollForCompletion(data.id);
    } catch (err) {
      setError('Failed to generate video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pollForCompletion = async (id: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/check-status?id=${id}`);
        const data = await response.json();

        if (data.state === 'completed' || data.state === 'failed') {
          setGenerations(prev => 
            prev.map(g => g.id === id ? {
              ...g,
              state: data.state,
              videoUrl: data.assets?.video
            } : g)
          );

          // Update in storage
          const stored = getGenerations();
          const updated = stored.map(g => g.id === id ? {
            ...g,
            state: data.state,
            videoUrl: data.assets?.video
          } : g);
          localStorage.setItem('generations', JSON.stringify(updated));

          return true; // Stop polling
        }
        return false; // Continue polling
      } catch (err) {
        console.error('Error checking status:', err);
        return true; // Stop polling on error
      }
    };

    // Poll every 2 seconds
    const poll = async () => {
      const shouldStop = await checkStatus();
      if (!shouldStop) {
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Luma AI Video Generator</title>
      </Head>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Luma AI Video Generator
        </h1>

        {!pubkey ? (
          <div className="text-center">
            <button
              onClick={connectNostr}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg"
            >
              Connect with Nostr
            </button>
            {error && (
              <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm">Connected: {pubkey.slice(0, 8)}...{pubkey.slice(-8)}</span>
              <button
                onClick={() => setPubkey(null)}
                className="text-sm text-gray-400 hover:text-white"
              >
                Disconnect
              </button>
            </div>

            <div className="relative">
              <textarea
                className="w-full p-4 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                disabled={loading}
              />
            </div>

            <button
              onClick={generateVideo}
              disabled={loading || !prompt}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg"
            >
              {loading ? 'Generating...' : 'Generate Video'}
            </button>

            {error && (
              <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {generations.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Your Generations</h2>
                {generations.map((gen) => (
                  <div key={gen.id} className="bg-gray-800 p-4 rounded-lg">
                    <p className="font-bold mb-2">{gen.prompt}</p>
                    <p className="text-sm text-gray-400 mb-2">Status: {gen.state}</p>
                    {gen.videoUrl ? (
                      <div>
                        <video
                          className="w-full rounded-lg"
                          controls
                          src={gen.videoUrl}
                          loop
                        />
                        <a
                          href={gen.videoUrl}
                          download
                          className="mt-2 inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                          Download Video
                        </a>
                      </div>
                    ) : gen.state === 'failed' ? (
                      <p className="text-red-400">Generation failed</p>
                    ) : (
                      <div className="animate-pulse flex space-x-4">
                        <div className="flex-1 space-y-4 py-1">
                          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-700 rounded"></div>
                            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
