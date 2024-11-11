// lib/nostr.ts
import { SimplePool } from 'nostr-tools/pool';
import { getEventHash, validateEvent, Event } from 'nostr-tools/pure';

export const DEFAULT_RELAY = 'wss://relay.damus.io';
export const BACKUP_RELAYS = ['wss://relay.nostrfreaks.com'];

const pool = new SimplePool();

export async function publishToRelays(event: Partial<Event>, relays: string[] = [DEFAULT_RELAY, ...BACKUP_RELAYS]): Promise<void> {
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  const finalEvent = {
    ...event,
    created_at: Math.floor(Date.now() / 1000),
  };

  finalEvent.id = getEventHash(finalEvent as Event);
  const signedEvent = await window.nostr.signEvent(finalEvent as Event);

  if (!validateEvent(signedEvent)) {
    throw new Error('Invalid event');
  }

  try {
    await Promise.all(
      relays.map(async (relay) => {
        try {
          await pool.publish([relay], signedEvent);
        } catch (error) {
          console.error(`Failed to publish to ${relay}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('Failed to publish event:', error);
    throw error;
  }
}

export async function publishVideo(videoUrl: string, prompt: string, isPublic: boolean): Promise<void> {
  // Animal Kind Event (75757)
  const animalEvent: Partial<Event> = {
    kind: 75757,
    tags: [
      ['title', prompt],
      ['r', videoUrl],
      ['type', 'animal-sunset']
    ],
    content: videoUrl,
  };
  
  await publishToRelays(animalEvent);

  // History Event (8008135)
  const historyEvent: Partial<Event> = {
    kind: 8008135,
    tags: [
      ['text-to-speech', prompt],
      ['r', videoUrl],
      ['e', animalEvent.id!],
      ['public', isPublic.toString()]
    ],
    content: JSON.stringify({
      prompt,
      videoUrl,
      createdAt: new Date().toISOString(),
      state: 'completed',
      public: isPublic
    }),
  };

  await publishToRelays(historyEvent);
}

export async function fetchLightningDetails(pubkey: string): Promise<{ lnurl?: string, lud16?: string } | null> {
  const events = await pool.querySync(
    [DEFAULT_RELAY],
    { kinds: [0], authors: [pubkey] }
  );

  const profileEvent = events[0];
  if (!profileEvent) return null;

  try {
    const profile = JSON.parse(profileEvent.content);
    return {
      lnurl: profile.lud06,
      lud16: profile.lud16
    };
  } catch (error) {
    console.error('Error parsing profile:', error);
    return null;
  }
}

export async function createZapInvoice(lnAddress: string, amount: number, comment?: string): Promise<string> {
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

export async function publishComment(content: string, parentId: string, kind: number): Promise<void> {
  const event: Partial<Event> = {
    kind,
    tags: [['e', parentId, '', 'reply']],
    content,
  };

  await publishToRelays(event);
}

export async function shareToNostr(content: string, videoUrl: string): Promise<void> {
  const event: Partial<Event> = {
    kind: 1,
    tags: [
      ['t', 'animalsunset'],
      ['r', videoUrl]
    ],
    content: content.trim(),
  };

  await publishToRelays(event);
}

// Helper function to fetch multiple events
export async function fetchEvents(filter: any): Promise<Event[]> {
  return await pool.querySync([DEFAULT_RELAY], filter);
}
