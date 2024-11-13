import type { Event } from 'nostr-tools';

declare global {
  interface Nostr {
    getPublicKey(): Promise<string>;
    signEvent(event: Partial<Event>): Promise<Event>;
    getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;
    nip04?: {
      encrypt(pubkey: string, plaintext: string): Promise<string>;
      decrypt(pubkey: string, ciphertext: string): Promise<string>;
    };
  }

  interface Window {
    nostr?: Nostr;
  }
}

export {};
