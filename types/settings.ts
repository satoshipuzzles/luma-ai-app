export interface UserSettings {
  publicGenerations: boolean;
  theme?: 'light' | 'dark';
  defaultRelay?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  publicGenerations: true,
  theme: 'dark',
  defaultRelay: 'wss://relay.nostrfreaks.com'
};
