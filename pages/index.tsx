// index.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import QRCode from 'qrcode.react'; // Import the QRCode component

// Types
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

interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

// Utility functions
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;

      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
    return 'Just now';
  } catch (e) {
    console.error('Date formatting error:', e);
    return 'Just now';
  }
};

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
      return 'AI is crafting your video...';
    case 'processing':
      return 'Almost there...';
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generations, setGenerations] = useState<StoredGeneration[]>([]);
  const [error, setError] = useState('');
  const [selectedGeneration, setSelectedGeneration] = useState<StoredGeneration | null>(null);

  // New state variables for payment
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);

  useEffect(() => {
    if (pubkey) {
      const stored = getGenerations().filter((g) => g.pubkey === pubkey);
      setGenerations(stored);
      if (stored.length > 0) {
        setSelectedGeneration(stored[0]);
      }
    }
  }, [pubkey]);

  useEffect(() => {
    const loadProfile = async () => {
      if (pubkey) {
        try {
          const response = await fetch(`/api/nostr/profile?pubkey=${pubkey}`);
          if (response.ok) {
            const profileData = await response.json();
            setProfile(profileData);
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      }
    };

    loadProfile();
  }, [pubkey]);

  const connectNostr = async () => {
    try {
      const key = await getNostrPublicKey();
      setPubkey(key);
    } catch (err) {
      setError('Failed to connect Nostr. Please install a NIP-07 extension like Alby.');
    }
  };

  // New waitForPayment function
  const waitForPayment = async (paymentHash: string) => {
    let isPaid = false;
    const invoiceExpirationTime = Date.now() + 600000; // 10 minutes from now

    while (!isPaid) {
      if (Date.now() > invoiceExpirationTime) {
        setError('Invoice has expired. Please try again.');
        setPaymentRequest(null);
        setPaymentHash(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/check-lnbits-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentHash }),
        });

        if (!response.ok) {
          throw new Error('Failed to check payment status');
        }

        const data = await response.json();
        isPaid = data.paid;

        if (!isPaid) {
          // Wait 5 seconds before checking again
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
        setError('Error checking payment status. Please try again.');
        setPaymentRequest(null);
        setPaymentHash(null);
        setLoading(false);
        return;
      }
    }
  };

  // Updated generateVideo function
  const generateVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt || !pubkey) return;

    setLoading(true);
    setError('');

    try {
      // Step 1: Create an invoice
      const invoiceResponse = await fetch('/api/create-lnbits-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 1000 }), // Amount in sats
      });

      if (!invoiceResponse.ok) {
        throw new Error('Failed to create invoice');
      }

      const invoiceData = await invoiceResponse.json();
      const { payment_request, payment_hash } = invoiceData;

      // Step 2: Display the invoice to the user and wait for payment
      setPaymentRequest(payment_request);
      setPaymentHash(payment_hash);

      // Wait for payment confirmation
      await waitForPayment(payment_hash);

      // Clear payment request
      setPaymentRequest(null);
      setPaymentHash(null);

      // Step 3: Proceed with generating the video
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
      console.log('Generation started:', data);

      if (!data.id) {
        throw new Error('Invalid response from server');
      }

      const newGeneration = {
        id: data.id,
        prompt,
        state: data.state || 'queued',
        createdAt: data.created_at || new Date().toISOString(),
        pubkey,
        videoUrl: data.assets?.video,
      };

      saveGeneration(newGeneration);
      setGenerations((prev) => [newGeneration, ...prev]);
      setSelectedGeneration(newGeneration);
      setPrompt('');
      pollForCompletion(data.id);
    } catch (err) {
      console.error('Generation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate video. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const pollForCompletion = async (generationId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/check-status?id=${generationId}`);
        if (!response.ok) {
          throw new Error('Failed to check status');
        }

        const data = await response.json();

        console.log('Raw status response:', data);
        console.log('Current state:', {
          id: data.id,
          state: data.state,
          hasVideo: !!data.assets?.video,
          videoUrl: data.assets?.video,
          assets: data.assets,
        });

        if (data.state === 'completed' && data.assets?.video) {
          console.log('Video URL found:', data.assets.video);

          setGenerations((prevGenerations) => {
            const existingGeneration = prevGenerations.find(
              (g) => g.id === generationId
            );

            if (!existingGeneration) {
              console.error('Generation not found in state');
              return prevGenerations;
            }

            const updatedGeneration = {
              ...existingGeneration,
              state: 'completed',
              videoUrl: data.assets.video,
              createdAt: data.created_at,
            };

            const updatedGenerations = prevGenerations.map((g) =>
              g.id === generationId ? updatedGeneration : g
            );

            // Update localStorage
            localStorage.setItem('generations', JSON.stringify(updatedGenerations));

            return updatedGenerations;
          });

          setSelectedGeneration((prevSelected) => {
            if (prevSelected?.id === generationId) {
              return {
                ...prevSelected,
                state: 'completed',
                videoUrl: data.assets.video,
                createdAt: data.created_at,
              };
            }
            return prevSelected;
          });

          return true; // Stop polling
        }

        // Update state for in-progress generations
        setGenerations((prevGenerations) => {
          const existingGeneration = prevGenerations.find(
            (g) => g.id === generationId
          );

          if (!existingGeneration) {
            console.error('Generation not found in state');
            return prevGenerations;
          }

          const updatedGeneration = {
            ...existingGeneration,
            state: data.state,
            createdAt: data.created_at,
          };

          return prevGenerations.map((g) =>
            g.id === generationId ? updatedGeneration : g
          );
        });

        setSelectedGeneration((prevSelected) => {
          if (prevSelected?.id === generationId) {
            return {
              ...prevSelected,
              state: data.state,
              createdAt: data.created_at,
            };
          }
          return prevSelected;
        });

        return false; // Continue polling
      } catch (err) {
        console.error('Status check error:', err);
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

  const copyVideoUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!pubkey) {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center">
        <div className="max-w-md w-full p-6 space-y-6">
          <h1 className="text-3xl font-bold text-center">Luma AI Video Generator</h1>
          <div className="bg-[#1a1a1a] p-8 rounded-lg shadow-xl space-y-4">
            <p className="text-gray-300 text-center">Connect with Nostr to get started</p>
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

      {/* Payment Modal */}
      {paymentRequest && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-sm w-full">
            <h2 className="text-xl font-bold">Pay to Generate Video</h2>
            <p className="text-sm text-gray-300">Please pay 1000 sats to proceed.</p>
            <div className="flex justify-center">
              <QRCode value={paymentRequest} size={256} />
            </div>
            <p className="text-sm text-gray-400 break-all">
              {paymentRequest}
            </p>
            <p className="text-sm text-gray-400">Waiting for payment confirmation...</p>
            <button
              onClick={() => {
                setPaymentRequest(null);
                setPaymentHash(null);
                setLoading(false);
              }}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex h-screen">
        <div className="w-64 bg-[#1a1a1a] border-r border-gray-800 hidden md:block overflow-auto">
          <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Your Videos</h2>
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
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400">
                      {formatDate(gen.createdAt)}
                    </p>
                    {gen.state === 'dreaming' ? (
                      <div className="flex items-center">
                        <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full mr-1"></div>
                        <span className="text-xs text-purple-400">Dreaming</span>
                      </div>
                    ) : (
                      gen.state === 'completed' && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <header className="bg-[#1a1a1a] border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Luma AI Video Generator</h1>
              <div className="flex items-center space-x-4">
                {profile?.picture && (
                  <img
                    src={profile.picture}
                    alt={profile.name || 'Profile'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div className="flex flex-col">
                  {profile?.name && (
                    <span className="text-sm font-medium">{profile.name}</span>
                  )}
                  <span className="text-sm text-gray-400">
                    {pubkey.slice(0, 8)}...{pubkey.slice(-8)}
                  </span>
                </div>
                <button
                  onClick={() => setPubkey(null)}
                  className="text-sm text-gray-400 hover:text-white transition duration-200"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {selectedGeneration ? (
              <div className="p-6">
                <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">
                        {selectedGeneration.prompt}
                      </h2>
                      <p className="text-sm text-gray-400 mt-1">
                        {formatDate(selectedGeneration.createdAt)}
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
                        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden">
                          <video
                            key={selectedGeneration.videoUrl} // Add key to force re-render
                            className="absolute top-0 left-0 w-full h-full object-contain"
                            controls
                            autoPlay
                            loop
                            src={selectedGeneration.videoUrl}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <a
                            href={selectedGeneration.videoUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            <span>Download Video</span>
                          </a>
                          <button
                            onClick={() =>
                              copyVideoUrl(selectedGeneration.videoUrl!)
                            }
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            <span>Copy Link</span>
                          </button>
                        </div>
                      </div>
                    ) : selectedGeneration.state === 'failed' ? (
                      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                        Generation failed. Please try again.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="relative h-64 bg-[#2a2a2a] rounded-lg overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="space-y-4 text-center">
                              <div className="inline-flex items-center space-x-2">
                                <svg
                                  className="animate-spin h-6 w-6 text-purple-500"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                <span className="text-purple-400 font-medium">
                                  AI is dreaming...
                                </span>
                              </div>
                              <div className="text-sm text-gray-400">
                                This usually takes 1-2 minutes
                              </div>
                            </div>
                          </div>
                        </div>
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
                        disabled={loading || !prompt || !!paymentRequest}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
                      >
                        {loading ? (
                          <span className="flex items-center space-x-2">
                            <svg
                              className="animate-spin h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
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
