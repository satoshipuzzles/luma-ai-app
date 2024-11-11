// nostr-tools.d.ts

declare module 'nostr-tools/pool' {
  export class SimplePool {
    constructor();

    subscribe(
      relays: string[],
      filters: any[],
      opts?: any
    ): {
      unsub: () => void;
    };

    close(relays: string[]): void;

    // Add other methods as needed
  }
}

declare module 'nostr-tools/pure' {
  export function getEventHash(event: any): string;
  export function validateEvent(event: any): boolean;
  export function generateSecretKey(): Uint8Array;
  export function getPublicKey(privateKey: Uint8Array): string;
  export function finalizeEvent(eventTemplate: any, privateKey: Uint8Array): any;

  // Add other functions and types as needed
}

declare module 'nostr-tools/event' {
  export type Event = any; // Define more specific types if possible
}
