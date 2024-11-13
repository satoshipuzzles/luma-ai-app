// contexts/NostrContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import { Event } from 'nostr-tools/event';
import NDK, { NDKEvent, NDKSigner } from '@nostr-dev-kit/ndk';

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: Event): Promise<Event>;
      getRelays?(): Promise<{ [url: string]: any }>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}

interface NostrContextType {
  pubkey: string | null;
  profile: any | null;
  ndk: NDK | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const NostrContext = createContext<NostrContextType | null>(null);

// Create a NIP-07 signer
class NIP07Signer implements NDKSigner {
  private pubkey: string | null = null;

  async blockUntilReady(): Promise<boolean> {
    return true;
  }

  async getPublicKey(): Promise<string> {
    if (this.pubkey) return this.pubkey;
    if (!window.nostr) throw new Error('Nostr extension not found');
    this.pubkey = await window.nostr.getPublicKey();
    return this.pubkey;
  }

  async sign(event: NDKEvent): Promise<string> {
    if (!window.nostr) throw new Error('Nostr extension not found');
    const signedEvent = await window.nostr.signEvent({
      ...event.rawEvent(),
      pubkey: await this.getPublicKey(),
    });
    return signedEvent.sig;
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
    if (typeof window === 'undefined' || !window.nostr) {
      throw new Error('Nostr extension not found');
    }
    const key = await window.nostr.getPublicKey();
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
