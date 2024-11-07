// pages/gallery.tsx

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { relayInit, Relay, Event, Filter, Sub } from 'nostr-tools';

interface AnimalKindEvent {
  id: string;
  pubkey: string;
  created_at: number;
  content: string; // Video URL
}

interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

const Gallery = () => {
  const [animalKinds, setAnimalKinds] = useState<AnimalKindEvent[]>([]);
  const [profiles, setProfiles] = useState<{ [pubkey: string]: Profile }>({});
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchAnimalKinds();
  }, []);

  const fetchAnimalKinds = async () => {
    try {
      // Initialize the relay connection
      const relay: Relay = relayInit('wss://sunset.nostrfreaks.com');

      // Define the filters for subscription
      const filters: Filter[] = [{ kinds: [75757] }];

      // Handle relay events
      relay.on('connect', () => {
        console.log(`Connected to relay: ${relay.url}`);

        // **Use 'sub' instead of 'subscribe'**
        const sub: Sub = relay.sub(filters, { skipVerification: true });

        // Listen for incoming events
        sub.on('event', (event: Event) => {
          const animalKind: AnimalKindEvent = {
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at,
            content: event.content,
          };
          setAnimalKinds((prev) => [...prev, animalKind]);
        });

        // Handle end of stored events
        sub.on('eose', () => {
          console.log('End of stored events');
          relay.close();
        });
      });

      // Handle relay errors
      relay.on('error', (err) => {
        console.error('Relay error:', err);
        setError('Failed to connect to the relay.');
      });

      // Establish the relay connection
      relay.connect();
    } catch (err) {
      console.error('Failed to fetch animal kinds:', err);
      setError('Failed to load gallery. Please try again later.');
    }
  };

export default Gallery;


  const fetchProfile = async (pubkey: string) => {
    if (profiles[pubkey]) return; // Profile already fetched

    try {
      const response = await fetch(`/api/nostr/profile?pubkey=${pubkey}`);
      if (response.ok) {
        const profileData: Profile = await response.json();
        setProfiles((prev) => ({ ...prev, [pubkey]: profileData }));
      } else {
        console.warn(`Profile not found for pubkey: ${pubkey}`);
      }
    } catch (err) {
      console.error(`Failed to fetch profile for ${pubkey}:`, err);
    }
  };

  const handleZap = (lightningAddress: string) => {
    alert('Zap functionality to be implemented.');
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Head>
        <title>Animal Sunset Gallery 🌞🦒</title>
        <link rel="icon" href="/favicon.png" />
        {/* Open Graph Meta Tags */}
        <meta name="description" content="Gallery of Animal Sunset creations." />
        <meta property="og:title" content="Animal Sunset Gallery 🌞🦒" />
        <meta property="og:description" content="Explore AI-generated animal videos." />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://animalsunset.com/gallery" />
        <meta property="og:type" content="website" />
      </Head>

      <header className="bg-[#1a1a1a] p-4">
        <h1 className="text-3xl font-bold text-center">Animal Sunset Gallery</h1>
      </header>

      <main className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {error && (
          <div className="col-span-full p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {animalKinds.map((event) => (
          <AnimalCard
            key={event.id}
            event={event}
            profile={profiles[event.pubkey]}
            fetchProfile={fetchProfile}
            onZap={handleZap}
          />
        ))}
      </main>
    </div>
  );
};

interface AnimalCardProps {
  event: AnimalKindEvent;
  profile?: Profile;
  fetchProfile: (pubkey: string) => void;
  onZap: (lightningAddress: string) => void;
}

const AnimalCard: React.FC<AnimalCardProps> = ({ event, profile, fetchProfile, onZap }) => {
  useEffect(() => {
    if (event.pubkey) fetchProfile(event.pubkey);
  }, [event.pubkey]);

  const [lightningAddress, setLightningAddress] = useState<string>('');

  useEffect(() => {
    const fetchLightningAddress = async () => {
      try {
        const response = await fetch(`/api/nostr/lightning-address?pubkey=${event.pubkey}`);
        if (response.ok) {
          const data = await response.json();
          setLightningAddress(data.lightning_address);
        }
      } catch (err) {
        console.error('Failed to fetch lightning address:', err);
      }
    };

    if (event.pubkey) {
      fetchLightningAddress();
    }
  }, [event.pubkey]);

  return (
    <div className="bg-[#1a1a1a] rounded-lg overflow-hidden shadow-lg">
      <video
        src={event.content}
        controls
        className="w-full h-48 object-cover"
        preload="metadata"
      ></video>
      <div className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          {profile?.picture ? (
            <img src={profile.picture} alt="Author" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
          )}
          <span className="font-semibold">{profile?.name || 'Anonymous'}</span>
        </div>
        <button
          onClick={() => onZap(lightningAddress)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1 px-3 rounded-lg"
        >
          Zap
        </button>
      </div>
    </div>
  );
};

export default Gallery;