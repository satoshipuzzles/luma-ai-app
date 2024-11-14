import React from 'react';
import { UserCircle } from 'lucide-react';
import { Profile } from '../types/nostr';

interface ProfileAvatarProps {
  profile?: Profile;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ 
  profile, 
  size = 'md',
  className = '' 
}) => {
  const [imageError, setImageError] = React.useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  if (!profile?.picture || imageError) {
    return (
      <div className={`${sizeClasses[size]} ${className} bg-gray-700 rounded-full flex items-center justify-center`}>
        <UserCircle className="text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={profile.picture}
      alt={profile.name || "Profile"}
      className={`${sizeClasses[size]} ${className} rounded-full object-cover`}
      onError={() => setImageError(true)}
    />
  );
};

export default ProfileAvatar;
