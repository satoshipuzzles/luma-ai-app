// types/settings.ts
import { GenerationOptions } from './luma';

export interface UserSettings {
  publicGenerations: boolean;
  theme?: 'light' | 'dark';
  defaultRelay: string;
  customRelays: string[];
  bitcoinConnectEnabled: boolean;
  bitcoinConnectPubkey?: string;
  defaultZapAmount: number;
  defaultGenerationOptions: Partial<GenerationOptions>;
}

export const DEFAULT_SETTINGS: UserSettings = {
  publicGenerations: true,
  theme: 'dark',
  defaultRelay: 'wss://relay.damus.io',
  customRelays: ['wss://relay.nostrfreaks.com'],
  bitcoinConnectEnabled: false,
  defaultZapAmount: 1000,
  defaultGenerationOptions: {
    model: 'ray-2',
    aspectRatio: '16:9',
    loop: true
  }
};
