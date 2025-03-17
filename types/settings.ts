// types/settings.ts
export interface UserSettings {
  publicGenerations: boolean;
  theme?: 'light' | 'dark';
  defaultRelay?: string;
  
  // Bitcoin Connect settings
  bitcoinConnectEnabled?: boolean;
  
  // Nostr Wallet Connect
  nostrWalletConnect?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  publicGenerations: true,
  theme: 'dark',
  defaultRelay: 'wss://relay.nostrfreaks.com',
  bitcoinConnectEnabled: false,
  nostrWalletConnect: ''
};
