// lib/nostr.ts

export {};

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: any): Promise<any>; // Return type adjusted to Promise<any>
    };
  }
}

import { SimplePool } from 'nostr-tools/pool';
import { getEventHash, validateEvent } from 'nostr-tools/pure';
import { Event } from 'nostr-tools/event';
import { Pub } from 'nostr-tools/relay';

export const DEFAULT_RELAY = 'wss://relay.damus.io';
export const BACKUP_RELAYS = ['wss://relay.nostrfreaks.com'];

const pool = new SimplePool();

type UnsignedEvent = Omit<Event, 'id' | 'sig' | 'pubkey' | 'created_at'>;

export async function publishToRelays(
  event: UnsignedEvent,
  relays: string[] = [DEFAULT_RELAY, ...BACKUP_RELAYS]
): Promise<Event> {
  if (typeof window === 'undefined' || !window.nostr) {
    throw new Error('Nostr extension not found');
  }

  // Include the pubkey in the event before hashing and signing
  const pubkey = await window.nostr.getPublicKey();
  const finalEvent: Event = {
    ...event,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };

  finalEvent.id = getEventHash(finalEvent);
  // Cast the result to 'Event'
  const signedEvent = (await window.nostr.signEvent(finalEvent)) as Event;

  if (!validateEvent(signedEvent)) {
    throw new Error('Invalid event');
  }

  try {
    // Publish to all relays simultaneously
    const pubs: Pub[] = pool.publish(relays, signedEvent);

    // Create an array of promises that resolve when each pub confirms publication
    const publishPromises: Promise<void>[] = pubs.map((pub) => {
      return new Promise<void>((resolve, reject) => {
        if (!pub) {
          // Handle the case where pub is null
          reject(new Error('Failed to publish to relay'));
          return;
        }
        pub.on('ok', () => resolve());
        pub.on('failed', () => reject(new Error('Publish failed')));
      });
    });

    // Wait until the event is published to at least one relay
    await Promise.any(publishPromises);

    // Return the signed event
    return signedEvent;
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw error;
  }
}

export async function publishVideo(
  videoUrl: string,
  prompt: string,
  isPublic: boolean
): Promise<void> {
  // Animal Kind Event (75757)
  const animalEvent: UnsignedEvent = {
    kind: 75757,
    tags: [
      ['title', prompt],
      ['r', videoUrl],
      ['type', 'animal-sunset'],
    ],
    content: videoUrl,
  };

  // Get the signed event, which includes the 'id'
  const signedAnimalEvent = await publishToRelays(animalEvent);

  // Ensure 'id' is not undefined
  if (!signedAnimalEvent.id) {
    throw new Error('Signed animal event does not have an id');
  }

  // Now you can access the 'id' property safely
  const historyEvent: UnsignedEvent = {
    kind: 8008135,
    tags: [
      ['text-to-speech', prompt],
      ['r', videoUrl],
      ['e', signedAnimalEvent.id], // 'id' is now guaranteed to be a string
      ['public', isPublic.toString()],
    ],
    content: JSON.stringify({
      prompt,
      videoUrl,
      createdAt: new Date().toISOString(),
      state: 'completed',
      public: isPublic,
    }),
  };

  await publishToRelays(historyEvent);
}
  // Fetch LNURL pay endpoint
  const response = await fetch(`https://${domain}/.well-known/lnurlp/${username}`);
  const { callback, maxSendable, minSendable } = await response.json();

  if (amount < minSendable || amount > maxSendable) {
    throw new Error('Amount out of bounds');
  }

  // Get payment request
  const callbackResponse = await fetch(
    `${callback}?amount=${amount}&comment=${encodeURIComponent(comment || '')}`
  );
  const { pr: paymentRequest } = await callbackResponse.json();

  return paymentRequest;
}

export async function publishComment(
  content: string,
  parentId: string,
  kind: number = 1
): Promise<void> {
  const event: UnsignedEvent = {
    kind,
    tags: [['e', parentId, '', 'reply']],
    content,
  };

  await publishToRelays(event);
}

export async function shareToNostr(
  content: string,
  videoUrl: string
): Promise<void> {
  const event: UnsignedEvent = {
    kind: 1,
    tags: [
      ['t', 'animalsunset'],
      ['r', videoUrl],
    ],
    content: content.trim(),
  };

  await publishToRelays(event);
}

// Helper function to fetch multiple events
export async function fetchEvents(filter: any): Promise<Event[]> {
  return await pool.list([DEFAULT_RELAY], [filter]);
}
