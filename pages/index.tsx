// pages/index.tsx

import { useState, useEffect } from 'react';
import Head from 'next/head';
import QRCode from 'qrcode.react';
import { relayInit, getEventHash, Event } from 'nostr-tools';

// Declare the global window.nostr interface
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
    };
  }
}

// Types
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
  if (!window.nostr) {
    throw new Error('Nostr extension not found. Please install a NIP-07 browser extension.');
  }
  return await window.nostr.getPublicKey();
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

  // State variables for payment
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);

  // State variables for Nostr sharing
  const [showNostrModal, setShowNostrModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

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

  // waitForPayment function
  const waitForPayment = async (paymentHash: string): Promise<boolean> => {
    let isPaid = false;
    const invoiceExpirationTime = Date.now() + 600000; // 10 minutes from now

    console.log('Waiting for payment with hash:', paymentHash);

    while (!isPaid) {
      if (Date.now() > invoiceExpirationTime) {
        setError('Invoice has expired. Please try again.');
        setPaymentRequest(null);
        setPaymentHash(null);
        setLoading(false);
        return false;
      }

      try {
        console.log('Checking payment status for hash:', paymentHash);

        const response = await fetch('/api/check-lnbits-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentHash }),
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error response from API:', errorData);
          // Do not throw an error here; instead, wait and check again
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const data = await response.json();
        console.log('Payment status response:', data);

        isPaid = data.paid === true;

        if (!isPaid) {
          // Wait 5 seconds before checking again
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
        // Do not close the modal; wait and check again
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.log('Payment confirmed for hash:', paymentHash);
    return true; // Return true to indicate payment was confirmed
  };

  // generateVideo function
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
        const errorData = await invoiceResponse.json();
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      const invoiceData = await invoiceResponse.json();
      const { payment_request, payment_hash } = invoiceData;

      console.log('Invoice created:', invoiceData);

      // Step 2: Display the invoice to the user and wait for payment
      setPaymentRequest(payment_request);
      setPaymentHash(payment_hash);

      // Wait for payment confirmation
      const paymentConfirmed = await waitForPayment(payment_hash);
      if (!paymentConfirmed) {
        // Payment was not confirmed, stop execution
        setLoading(false);
        return;
      }

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

      const newGeneration: StoredGeneration = {
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

  // publishNote function
  const publishNote = async () => {
    if (!pubkey || !window.nostr) {
      setPublishError('Nostr extension not found. Please install a NIP-07 browser extension.');
      return;
    }

    setPublishing(true);
    setPublishError('');

    try {
      const event: Partial<Event> = {
        kind: 1,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: noteContent,
      };

      // Get the event hash
      event.id = getEventHash(event as Event);

      // Sign the event
      const signedEvent = await window.nostr.signEvent(event as Event);

      // Verify the signature
      if (signedEvent.id !== event.id) {
        throw new Error('Event ID mismatch after signing.');
      }

      // Connect to the relays
      const relays = ['wss://relay.damus.io', 'wss://relay.nostrefreaks.com'];

      const relayConnections = relays.map((url) => relayInit(url));

      // Publish the event to each relay
      await Promise.all(
        relayConnections.map(async (relay) => {
          await relay.connect();

          return new Promise((resolve, reject) => {
            relay.on('connect', () => {
              console.log(`Connected to relay ${relay.url}`);
              const pub = relay.publish(signedEvent);
              pub.on('ok', () => {
                console.log(`Event published to ${relay.url}`);
                resolve(null);
              });
              pub.on('failed', (reason: string) => {
                console.error(`Failed to publish to ${relay.url}: ${reason}`);
                reject(new Error(`Failed to publish to ${relay.url}: ${reason}`));
              });
            });

            relay.on('error', () => {
              console.error(`Failed to connect to relay ${relay.url}`);
              reject(new Error(`Failed to connect to relay ${relay.url}`));
            });
          });
        })
      );

      // Close relay connections
      relayConnections.forEach((relay) => relay.close());

      setPublishing(false);
      setShowNostrModal(false);
    } catch (err) {
      console.error('Error publishing note:', err);
      setPublishError(
        err instanceof Error
          ? err.message
          : 'Failed to publish note. Please try again.'
      );
      setPublishing(false);
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
            <p className="text-sm text-gray-400 break-all">{paymentRequest}</p>
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

      {/* Nostr Note Modal */}
      {showNostrModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-[#1a1a1a] p-6 rounded-lg space-y-4 max-w-md w-full">
            <h2 className="text-xl font-bold">Share on Nostr</h2>
            <textarea
              className="w-full bg-[#2a2a2a] rounded-lg border border-gray-700 p-4 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition duration-200"
              rows={4}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note..."
            />
            {publishError && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                {publishError}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNostrModal(false)}
                className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={publishNote}
                disabled={publishing}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-screen">
        {/* Sidebar */}
        {/* ... existing sidebar code ... */}
        <div className="w-64 bg-[#1a1a1a] p-6 space-y-4 overflow-y-auto">
          <h2 className="text-2xl font-bold">Your Generations</h2>
          {generations.length > 0 ? (
            <ul className="space-y-2">
              {generations.map((generation) => (
                <li
                  key={generation.id}
                  className={`p-2 rounded-lg cursor-pointer ${
                    selectedGeneration?.id === generation.id ? 'bg-purple-700' : 'hover:bg-gray-700'
                  }`}
                  onClick={() => setSelectedGeneration(generation)}
                >
                  <div className="text-sm font-medium">{generation.prompt}</div>
                  <div className="text-xs text-gray-400">{formatDate(generation.createdAt)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No generations yet.</p>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {/* Header */}
          {/* ... existing header code ... */}
          <div className="bg-[#1a1a1a] p-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Luma AI Video Generator</h1>
            {profile && (
              <div className="flex items-center space-x-2">
                {profile.picture && (
                  <img
                    src={profile.picture}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span>{profile.name || 'Anonymous'}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {selectedGeneration ? (
              <div className="p-6">
                <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-4">
                  {/* Generation Details */}
                  <h2 className="text-xl font-bold">{selectedGeneration.prompt}</h2>
                  <div className="text-sm text-gray-400">
                    {formatDate(selectedGeneration.createdAt)}
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    {/* Status Message */}
                    <div className="text-sm text-gray-300">
                      {getStatusMessage(selectedGeneration.state)}
                    </div>

                    {selectedGeneration.videoUrl ? (
                      <div className="space-y-4">
                        {/* Video Player */}
                        <video
                          src={selectedGeneration.videoUrl}
                          controls
                          className="w-full rounded-lg"
                        ></video>

                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => copyVideoUrl(selectedGeneration.videoUrl!)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            Copy Video URL
                          </button>
                          <a
                            href={selectedGeneration.videoUrl}
                            download
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            Download Video
                          </a>
                          {/* Share on Nostr Button */}
                          <button
                            onClick={() => {
                              setNoteContent(selectedGeneration.prompt);
                              setShowNostrModal(true);
                            }}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5C10.62 11.5 9.5 10.38 9.5 9S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z" />
                            </svg>
                            <span>Share on Nostr</span>
                          </button>
                        </div>
                      </div>
                    ) : selectedGeneration.state === 'failed' ? (
                      <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                        Generation failed. Please try again.
                      </div>
                    ) : (
                      // When videoUrl is not available
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
                {/* When no generation is selected */}
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
