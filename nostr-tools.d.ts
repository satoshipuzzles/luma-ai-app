// nostr-tools.d.ts

declare module 'nostr-tools/pool' {
  export class SimplePool {
    // Define the methods and properties you use
    subscribe(
      relays: string[],
      filters: any[],
      opts?: any
    ): { unsub: () => void };
    // Add other methods as needed
  }
}

declare module 'nostr-tools/pure' {
  export function getEventHash(event: any): string;
  export function validateEvent(event: any): boolean;
  export type Event = any; // Adjust with proper types if available
  // Add other functions and types as needed
}
