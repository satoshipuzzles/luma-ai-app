// lib/nostr.ts
import { Event, getEventHash, nip19, Filter } from 'nostr-tools';

export const createNostrPost = async (
  content: string,
  tags: string[][],
  kind: number = 1
): Promise<Event> => {
  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  const event: Partial<Event> = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };

  event.id = getEventHash(event as Event);
  return await window.nostr.signEvent(event as Event);
};

export const createAnimalKind = async (
  pubkey: string,
  videoUrl: string,
  title: string,
  replyTo?: string
): Promise<Event> => {
  const tags: string[][] = [
    ['title', title],
    ['t', 'AnimalSunset']
  ];

  if (replyTo) {
    tags.push(['e', replyTo]);
  }

  const event: Partial<Event> = {
    kind: 75757,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: videoUrl,
    pubkey
  };

  event.id = getEventHash(event as Event);

  if (!window.nostr) {
    throw new Error('Nostr extension not found');
  }

  return await window.nostr.signEvent(event as Event);
};

export const publishToRelays = async (
  event: Event,
  relays: string[]
): Promise<void> => {
  const publishPromises = relays.map(async (relay) => {
    try {
      const ws = new WebSocket(relay);
      
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Publish timeout'));
        }, 5000);

        ws.onopen = () => {
          ws.send(JSON.stringify(['EVENT', event]));
        };

        ws.onmessage = (msg) => {
          const data = JSON.parse(msg.data.toString());
          if (data[0] === 'OK' && data[1] === event.id) {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          ws.close();
          reject(error);
        };
      });
    } catch (error) {
      console.error(`Failed to publish to ${relay}:`, error);
      throw error;
    }
  });

  try {
    await Promise.all(publishPromises);
  } catch (error) {
    console.error('Failed to publish to some relays:', error);
    throw error;
  }
};

export const formatPubkey = (pubkey: string): string => {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey.slice(0, 8) + '...' + pubkey.slice(-8);
  }
};
