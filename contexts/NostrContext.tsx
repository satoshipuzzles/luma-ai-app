import React, { createContext, useContext, useState, useEffect } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import NDK, { NDKEvent, NDKSigner, NDKUser, NostrEvent } from '@nostr-dev-kit/ndk';
import type { Event } from 'nostr-tools';

// Define our own interfaces without modifying global
interface Nip04 {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

interface NostrWindow {
  getPublicKey(): Promise<string>;
  signEvent(event: Partial<Event>): Promise<Event>;
  getRelays?(): Promise<{ [url: string]: { read: boolean; write: boolean } }>;
  nip04?: Nip04;
}

interface NostrContextType {
  pubkey: string | null;
  profile: any | null;
  ndk: NDK | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const NostrContext = createContext<NostrContextType | null>(null);

class NIP07Signer implements NDKSigner {
  private pubkey: string | null = null;
  private _user: NDKUser | null = null;

  private getNostr(): NostrWindow | undefined {
    return (window as any).nostr as NostrWindow | undefined;
  }

  async user(): Promise<NDKUser> {
    if (!this._user) {
      const pubkey = await this.getPublicKey();
      this._user = new NDKUser({ pubkey });
    }
    return this._user;
  }

  async blockUntilReady(): Promise<NDKUser> {
    return this.user();
  }

  async getPublicKey(): Promise<string> {
    if (this.pubkey) return this.pubkey;
    const nostr = this.getNostr();
    if (!nostr) throw new Error('Nostr extension not found');
    this.pubkey = await nostr.getPublicKey();
    return this.pubkey;
  }

  async sign(event: NostrEvent): Promise<string> {
    const nostr = this.getNostr();
    if (!nostr) throw new Error('Nostr extension not found');
    
    const eventToSign = {
      ...event,
      pubkey: event.pubkey || await this.getPublicKey(),
      kind: event.kind,
      created_at: event.created_at || Math.floor(Date.now() / 1000),
      content: event.content,
      tags: event.tags || []
    };

    const signedEvent = await nostr.signEvent(eventToSign);
    return signedEvent.sig;
  }

  async encrypt(recipient: NDKUser, value: string): Promise<string> {
    const nostr = this.getNostr();
    if (!nostr?.nip04) {
      throw new Error('NIP-04 encryption not supported');
    }
    return nostr.nip04.encrypt(recipient.pubkey, value);
  }

  async decrypt(sender: NDKUser, value: string): Promise<string> {
    const nostr = this.getNostr();
    if (!nostr?.nip04) {
      throw new Error('NIP-04 encryption not supported');
    }
    return nostr.nip04.decrypt(sender.pubkey, value);
  }

  async nip04Encrypt(recipient: NDKUser, value: string): Promise<string> {
    const nostr = this.getNostr();
    if (!nostr?.nip04) {
      throw new Error('NIP-04 encryption not supported');
    }
    return nostr.nip04.encrypt(recipient.pubkey, value);
  }

  async nip04Decrypt(sender: NDKUser, value: string): Promise<string> {
    const nostr = this.getNostr();
    if (!nostr?.nip04) {
      throw new Error('NIP-04 encryption not supported');
    }
    return nostr.nip04.decrypt(sender.pubkey, value);
  }

  get lud16(): string | undefined {
    return undefined;
  }

  get npub(): string | undefined {
    return undefined;
  }
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [ndk, setNdk] = useState<NDK | null>(null);
  const pool = new SimplePool();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPubkey = localStorage.getItem('nostr_pubkey');
      if (storedPubkey) {
        setPubkey(storedPubkey);
        fetchProfile(storedPubkey);
      }

      // Initialize NDK
      const signer = new NIP07Signer();
      const ndkInstance = new NDK({
        explicitRelayUrls: ['wss://relay.damus.io', 'wss://relay.nostrfreaks.com'],
        signer
      });

      ndkInstance.connect().then(() => {
        setNdk(ndkInstance);
      }).catch(console.error);
    }
  }, []);

  const fetchProfile = async (pk: string) => {
    try {
      const relays = ['wss://relay.damus.io'];
      const events = await pool.list(relays, [{ kinds: [0], authors: [pk] }]);
      const profileEvent = events[0];
      if (profileEvent) {
        const profileData = JSON.parse(profileEvent.content);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const connect = async () => {
    if (typeof window === 'undefined' || !(window as any).nostr) {
      throw new Error('Nostr extension not found');
    }
    const nostr = (window as any).nostr as NostrWindow;
    const key = await nostr.getPublicKey();
    setPubkey(key);
    localStorage.setItem('nostr_pubkey', key);
    await fetchProfile(key);
  };

  const disconnect = () => {
    setPubkey(null);
    setProfile(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nostr_pubkey');
    }
  };

  return (
    <NostrContext.Provider value={{ pubkey, profile, ndk, connect, disconnect }}>
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr() {
  const context = useContext(NostrContext);
  if (!context) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
}
