// pages/index.tsx

import { useState, useEffect, useRef } from 'react';
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

  // State for responsive sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Ref to control polling
  const pollingRef = useRef<boolean>(true);

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
    pollingRef.current = true; // Allow polling

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
      if (!pollingRef.current) return true; // Stop polling if flag is false
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
      if (!shouldStop && pollingRef.current) {
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
      setPublishError(
        'Nostr extension not found. Please install a NIP-07 browser extension.'
      );
      return;
    }

    setPublishing(true);
    setPublishError('');

    let relayConnections: ReturnType<typeof relayInit>[] = [];

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

      // List of relay URLs
      const relayUrls = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];

      // Initialize relay connections
      relayConnections = relayUrls.map((url) => relayInit(url));

      // Publish to each relay
      await Promise.all(
        relayConnections.map((relay) => {
          return new Promise<void>((resolve, reject) => {
            relay.on('connect', async () => {
              console.log(`Connected to relay ${relay.url}`);
              try {
                await relay.publish(signedEvent);
                console.log(`Event published to ${relay.url}`);
                resolve();
              } catch (error) {
                console.error(`Failed to publish to relay ${relay.url}:`, error);
                reject(error);
              } finally {
                relay.close();
              }
            });

            relay.on('error', () => {
              console.error(`Failed to connect to relay ${relay.url}`);
              reject(new Error(`Failed to connect to relay ${relay.url}`));
            });

            relay.connect();
          });
        })
      );
    } catch (err) {
      console.error('Error publishing note:', err);
      setPublishError(
        err instanceof Error ? err.message : 'Failed to publish note. Please try again.'
      );
    } finally {
      // Close relay connections
      relayConnections.forEach((relay) => relay.close());
      setPublishing(false);
      setShowNostrModal(false);
    }
  };

  // publishToRelay function
  const publishToRelay = async (generation: StoredGeneration) => {
    if (!pubkey || !window.nostr) {
      setPublishError(
        'Nostr extension not found. Please install a NIP-07 browser extension.'
      );
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
        content: `Video Prompt: ${generation.prompt}\nVideo URL: ${generation.videoUrl}`,
      };

      // Get the event hash
      event.id = getEventHash(event as Event);

      // Sign the event
      const signedEvent = await window.nostr.signEvent(event as Event);

      // Verify the signature
      if (signedEvent.id !== event.id) {
        throw new Error('Event ID mismatch after signing.');
      }

      // Relay URL for relay.nostrfreaks.com
      const relayUrl = 'wss://relay.nostrfreaks.com';
      const relay = relayInit(relayUrl);

      // Publish to relay
      await new Promise<void>((resolve, reject) => {
        relay.on('connect', async () => {
          console.log(`Connected to relay ${relay.url}`);
          try {
            await relay.publish(signedEvent);
            console.log(`Event published to ${relay.url}`);
            resolve();
          } catch (error) {
            console.error(`Failed to publish to relay ${relay.url}:`, error);
            reject(error);
          } finally {
            relay.close();
          }
        });

        relay.on('error', () => {
          console.error(`Failed to connect to relay ${relay.url}`);
          reject(new Error(`Failed to connect to relay ${relay.url}`));
        });

        relay.connect();
      });
    } catch (err) {
      console.error('Error publishing to relay:', err);
      setPublishError(
        err instanceof Error ? err.message : 'Failed to publish to relay. Please try again.'
      );
    } finally {
      setPublishing(false);
    }
  };

  // Render when not connected
  if (!pubkey) {
    return (
      <div
        className="min-h-screen text-white flex items-center justify-center"
        style={{
          backgroundImage: `url('https://animalsunset.com/public/images/background.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative z-10 max-w-md w-full p-6 space-y-6 bg-[#1a1a1a] bg-opacity-80 rounded-lg">
          <h1 className="text-3xl font-bold text-center">Animal Sunset 🌞🦒</h1>
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
    );
  }

  return (
    <div
      className="min-h-screen text-white relative"
      style={{
        backgroundImage: `url('https://animalsunset.com/public/images/background.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="relative z-10 flex flex-col md:flex-row h-screen">
        {/* Overlay for Sidebar on Mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black opacity-50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 transform ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 md:relative md:inset-0 bg-[#1a1a1a] p-6 space-y-4 overflow-y-auto transition-transform duration-200 ease-in-out z-50`}
        >
          {/* Close button for mobile */}
          <button
            className="md:hidden text-white focus:outline-none mb-4"
            onClick={() => setIsSidebarOpen(false)}
          >
            {/* Close Icon */}
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
          <h2 className="text-2xl font-bold">Your Generations</h2>
          {generations.length > 0 ? (
            <ul className="space-y-2">
              {generations.map((generation) => (
                <li
                  key={generation.id}
                  className={`p-2 rounded-lg cursor-pointer ${
                    selectedGeneration?.id === generation.id
                      ? 'bg-purple-700'
                      : 'hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    setSelectedGeneration(generation);
                    setIsSidebarOpen(false); // Close sidebar on mobile after selection
                  }}
                >
                  <div className="text-sm font-medium">{generation.prompt}</div>
                  <div className="text-xs text-gray-400">
                    {formatDate(generation.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">No generations yet.</p>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-[#1a1a1a] p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Menu Button for Mobile */}
              <button
                className="md:hidden text-white focus:outline-none"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {/* Hamburger Icon */}
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  ></path>
                </svg>
              </button>
              <h1 className="text-2xl font-bold">Animal Sunset</h1>
            </div>
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
                  {/* Generation Details with Close Button */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedGeneration.prompt}</h2>
                      <div className="text-sm text-gray-400 mt-1">
                        {formatDate(selectedGeneration.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedGeneration(null);
                        setLoading(false);
                        pollingRef.current = false; // Stop polling
                        setError('');
                      }}
                      className="text-gray-400 hover:text-white"
                      aria-label="Close Generation"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    {/* Status Message */}
                    <div className="text-sm text-gray-300 mb-4">
                      {getStatusMessage(selectedGeneration.state)}
                    </div>

                    {selectedGeneration.videoUrl ? (
                      <div className="space-y-4">
                        {/* Video Player */}
                        <div className="relative pt-[56.25%] bg-black rounded-lg overflow-hidden">
                          <video
                            key={selectedGeneration.videoUrl}
                            className="absolute top-0 left-0 w-full h-full object-contain"
                            controls
                            autoPlay
                            loop
                            src={selectedGeneration.videoUrl}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap space-x-2">
                          <button
                            onClick={() => copyVideoUrl(selectedGeneration.videoUrl!)}
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            {/* Copy Link Icon */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8 4a3 3 0 00-3 3v1H5a2 2 0 00-2 2v4a2 2 0 002 2h3v1a3 3 0 003 3h4a3 3 0 003-3v-1h3a2 2 0 002-2v-4a2 2 0 00-2-2h-3V7a3 3 0 00-3-3H8zm-1 6a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1 4a1 1 0 100-2h4a1 1 0 100 2H8z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>Copy Video URL</span>
                          </button>
                          <a
                            href={selectedGeneration.videoUrl}
                            download
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            {/* Download Icon */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M3 3a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm5 7a1 1 0 012 0v3a1 1 0 01-2 0v-3zm2-3a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span>Download Video</span>
                          </a>
                          {/* Share on Nostr Button */}
                          <button
                            onClick={() => {
                              setNoteContent(
                                `${selectedGeneration.prompt}\n\nWatch the video here: ${selectedGeneration.videoUrl}`
                              );
                              setShowNostrModal(true);
                            }}
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            {/* Share Icon */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M15 8a3 3 0 10-3-3 3 3 0 003 3zM9 8a3 3 0 100-6 3 3 0 000 6zM9 14a3 3 0 01-2.995-2.824L6 11a3 3 0 115.995-.176A3 3 0 019 14z" />
                            </svg>
                            <span>Share on Nostr</span>
                          </button>
                          {/* Publish to Relay Button */}
                          <button
                            onClick={() => publishToRelay(selectedGeneration)}
                            disabled={publishing}
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                          >
                            {/* Relay Icon */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M4 3a1 1 0 00-1 1v4a1 1 0 001 1h3v6H5a1 1 0 00-1 1v2a1 1 0 001 1h10a1 1 0 001-1v-2a1 1 0 00-1-1h-1v-6h3a1 1 0 001-1V4a1 1 0 00-1-1H4zM5 8h10v8H5V8z" />
                            </svg>
                            <span>{publishing ? 'Publishing...' : 'Publish to Relay'}</span>
                          </button>
                        </div>
                        {publishError && (
                          <div className="p-2 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                            {publishError}
                          </div>
                        )}
                      </div>
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
                pollingRef.current = false; // Stop polling if any
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
    </div>
  );
}
