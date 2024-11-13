import React, { createContext, useContext, useState, useEffect } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import NDK, { NDKEvent, NDKSigner, NDKUser } from '@nostr-dev-kit/ndk';
import type { Event } from 'nostr-tools';

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
