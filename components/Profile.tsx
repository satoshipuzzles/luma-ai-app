// components/Profile.tsx

import React, { useEffect } from 'react';
import { useNostr } from '../contexts/NostrContext';

const Profile: React.FC = () => {
  const { pubkey, profile, connect, disconnect } = useNostr();

  useEffect(() => {
    if (!pubkey && !profile) {
      connect().catch(console.error);
    }
  }, [pubkey, profile, connect]);

  const handleDisconnect = () => {
    disconnect();
  };

  if (!pubkey) {
    return <button onClick={connect}>Connect Nostr</button>;
  }

  return (
    <div>
      <h2>Profile</h2>
      {profile ? (
        <div>
          <p><strong>Public Key:</strong> {pubkey}</p>
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>About:</strong> {profile.about}</p>
          {/* Add more profile fields as needed */}
        </div>
      ) : (
        <p>Loading profile...</p>
      )}
      <button onClick={handleDisconnect}>Disconnect</button>
    </div>
  );
};

export default Profile;
