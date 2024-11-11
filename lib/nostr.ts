// lib/nostr.ts

import { SimplePool } from 'nostr-tools/pool';
import { getEventHash, validateEvent } from 'nostr-tools/pure';
import { Event } from 'nostr-tools/event';

export const DEFAULT_RELAY = 'wss://relay.damus.io';
export const BACKUP_RELAYS = ['wss://relay.nostrfreaks.com'];

const pool = new SimplePool();

type UnsignedEvent = Omit<Event, 'id' | 'sig' | 'pubkey' | 'created_at'>;

export async function publishToRelays(
  event: UnsignedEvent,
  relays: string[] = [DEFAULT_RELAY, ...BACKUP_RELAYS]
): Promise<void> {
  if (typeof window === 'undefined' || !window.nostr) {
    throw new Error('Nostr extension not found');
  }

  // Include the pubkey in the event before hashing and signing
  const finalEvent: Event = {
    ...event,
    pubkey: await window.nostr.getPublicKey(),
    created_at: Math.floor(Date.now() / 1000),
  };

  finalEvent.id = getEventHash(finalEvent);
  const signedEvent = await window.nostr.signEvent(finalEvent);

  if (!validateEvent(signedEvent)) {
    throw new Error('Invalid event');
  }

  try {
    // Publish to all relays simultaneously
    const publishPromises = pool.publish(relays, signedEvent);

    // Wait until the event is published to at least one relay
    await Promise.any(publishPromises);
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

  await publishToRelays(animalEvent);

  // History Event (8008135)
  const historyEvent: UnsignedEvent = {
    kind: 8008135,
    tags: [
      ['text-to-speech', prompt],
      ['r', videoUrl],
      ['e', animalEvent.id!],
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

export async function fetchLightningDetails(
  pubkey: string
): Promise<{ lnurl?: string; lud16?: string } | null> {
  const events = await pool.list([DEFAULT_RELAY], [{ kinds: [0], authors: [pubkey] }]);

  const profileEvent = events[0];
  if (!profileEvent) return null;

  try {
    const profile = JSON.parse(profileEvent.content);
    return {
      lnurl: profile.lud06,
      lud16: profile.lud16,
    };
  } catch (error) {
    console.error('Error parsing profile:', error);
    return null;
  }
}

export async function createZapInvoice(
  lnAddress: string,
  amount: number,
  comment?: string
): Promise<string> {
  const [username, domain] = lnAddress.split('@');

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
