// types/settings.ts
export interface UserSettings {
  publicGenerations: boolean;
  theme?: 'light' | 'dark';
  defaultRelay?: string;
  
  // Bitcoin Connect settings
  bitcoinConnectEnabled?: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  publicGenerations: true,
  theme: 'dark',
  defaultRelay: 'wss://relay.nostrfreaks.com',
  bitcoinConnectEnabled: false
};
