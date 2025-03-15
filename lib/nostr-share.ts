// lib/nostr-share.ts
import { Event, getEventHash } from 'nostr-tools';

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

    // Publish to relays
    const relays = ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'];
    
    for (const relayUrl of relays) {
      try {
        const relay = window.NostrTools ? 
          new window.NostrTools.Relay(relayUrl) : 
          { publish: () => { throw new Error('NostrTools not available'); } };
          
        await relay.publish(signedEvent);
      } catch (relayError) {
        console.warn(`Failed to publish to relay ${relayUrl}:`, relayError);
        // Continue with other relays even if one fails
      }
    }

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
