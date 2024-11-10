import { relayInit, Event } from 'nostr-tools';

const DEFAULT_RELAY = 'wss://relay.damus.io';

export async function publishEvent(event: Partial<Event>, relayUrl: string = DEFAULT_RELAY): Promise<void> {
  const relay = relayInit(relayUrl);
  
  return new Promise((resolve, reject) => {
    relay.on('connect', async () => {
      try {
        const signedEvent = await window.nostr.signEvent(event as Event);
        await relay.publish(signedEvent);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        relay.close();
      }
    });

    relay.on('error', () => {
      reject(new Error(`Failed to connect to relay ${relayUrl}`));
    });

    relay.connect();
  });
}

export async function fetchLightningAddress(pubkey: string): Promise<string | null> {
  try {
    const relay = relayInit(DEFAULT_RELAY);
    
    return new Promise((resolve) => {
      relay.on('connect', () => {
        const sub = relay.sub([
          {
            kinds: [0],
            authors: [pubkey],
          },
        ]);

        sub.on('event', (event) => {
          try {
            const profile = JSON.parse(event.content);
            if (profile.lud16 || profile.lud06) {
              resolve(profile.lud16 || profile.lud06);
              sub.unsub();
              relay.close();
            }
          } catch (error) {
            console.error('Error parsing profile:', error);
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          sub.unsub();
          relay.close();
          resolve(null);
        }, 5000);
      });

      relay.connect();
    });
  } catch (error) {
    console.error('Error fetching lightning address:', error);
    return null;
  }
}

export async function createZapInvoice(lnAddress: string, amount: number): Promise<{ payment_request: string, payment_hash: string }> {
  // Extract username and domain from Lightning Address
  const [username, domain] = lnAddress.split('@');
  
  // Fetch LN URL callback from .well-known
  const response = await fetch(`https://${domain}/.well-known/lnurlp/${username}`);
  const lnurlData = await response.json();
  
  // Create invoice using callback URL
  const callbackResponse = await fetch(`${lnurlData.callback}?amount=${amount * 1000}`);
  const { pr: payment_request, payment_hash } = await callbackResponse.json();
  
  return { payment_request, payment_hash };
}

export async function publishComment(content: string, parentId: string, kind: number): Promise<void> {
  const event: Partial<Event> = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', parentId]], // Reference to parent event
    content,
  };

  await publishEvent(event);
}

export async function shareToNostr(content: string, videoUrl: string): Promise<void> {
  const event: Partial<Event> = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'animalsunset'],
      ['r', videoUrl]
    ],
    content,
  };

  await publishEvent(event);
}
