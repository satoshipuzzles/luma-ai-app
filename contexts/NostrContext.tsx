// contexts/NostrContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SimplePool } from 'nostr-tools/pool'; // Added import
import { Event } from 'nostr-tools/event'; // Added import

// Define the WindowNostr interface directly
interface WindowNostr {
  getPublicKey(): Promise<string>;
  signEvent(event: Event): Promise<Event>;
  getRelays?(): Promise<{ [url: string]: any }>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

// Extend the Window interface to include 'nostr'
declare global {
  interface Window {
    nostr?: WindowNostr;
  }
}

interface NostrContextType {
  pubkey: string | null;
  profile: any | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const NostrContext = createContext<NostrContextType | null>(null);

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  const pool = new SimplePool(); // Initialize the pool inside the component

  useEffect(() => {
    // Check for existing pubkey in localStorage
    const storedPubkey = localStorage.getItem('nostr_pubkey');
    if (storedPubkey) {
      setPubkey(storedPubkey);
      fetchProfile(storedPubkey);
    }
  }, []);

  const fetchProfile = async (pk: string) => {
    try {
      // Use nostr-tools to fetch the profile from relays
      const relays = ['wss://relay.damus.io']; // Adjust the relay list as needed
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
    if (!window.nostr) {
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
    localStorage.removeItem('nostr_pubkey');
  };

  return (
    <NostrContext.Provider value={{ pubkey, profile, connect, disconnect }}>
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
