// contexts/NostrContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { WindowNostr } from 'nostr-tools/nip07';

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
      const relays = ['wss://relay.damus.io']; // You can adjust the relay list as needed
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
