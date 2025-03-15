// lib/nostr-share.ts
import { Event, getEventHash, relayInit } from 'nostr-tools';

// Define interfaces for window with Nostr
declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>;
    }
  }
}

// Function to publish a regular note (kind 1) with video content
export const publishNostrNote = async (
  content: string,
  videoUrl: string,
  pubkey: string
): Promise<void> => {
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  try {
    // Create a regular note (kind 1) with video URL
    const noteEvent: Partial<Event> = {
      kind: 1,
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['r', videoUrl], // Reference to the video
        ['type', 'animal-sunset'],
        ['t', 'animalsunset'], // Add a tag for filtering
      ],
      content: content,
    };

    noteEvent.id = getEventHash(noteEvent as Event);
    const signedEvent = await window.nostr.signEvent(noteEvent as Event);

    // Publish to relays using nostr-tools relayInit
    const relayUrls = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];
    const relayConnections = relayUrls.map(url => relayInit(url));
    
    // Using Promise.allSettled to handle relay connection failures gracefully
    await Promise.allSettled(
      relayConnections.map(relay => {
        return new Promise<void>((resolve, reject) => {
          let connected = false;
          
          relay.on('connect', async () => {
            connected = true;
            try {
              await relay.publish(signedEvent);
              resolve();
            } catch (error) {
              reject(error);
            } finally {
              // Close the connection after publishing
              relay.close();
            }
          });

          relay.on('error', () => {
            if (!connected) {
              reject(new Error(`Failed to connect to relay ${relay.url}`));
            }
          });

          // Set timeout for relay connection
          setTimeout(() => {
            if (!connected) {
              reject(new Error(`Connection timeout for relay ${relay.url}`));
              relay.close();
            }
          }, 5000);

          relay.connect();
        });
      })
    );

    return;
  } catch (err) {
    console.error('Error publishing to Nostr:', err);
    throw err;
  }
};

// Replace the share function in index.tsx with this version:
export const shareToNostr = async (
  videoUrl: string, 
  prompt: string,
  note: string,
  pubkey: string
): Promise<void> => {
  // Format the content to include the prompt and any additional note text
  const content = note || `Check out my Animal Sunset video: ${prompt}\n\n${videoUrl}`;
  
  // Publish as a regular note
  await publishNostrNote(content, videoUrl, pubkey);
};
