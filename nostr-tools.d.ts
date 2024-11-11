// nostr-tools.d.ts

declare module 'nostr-tools/pool' {
  export class SimplePool {
    constructor();

    subscribe(
      relays: string[],
      filters: any[],
      opts?: {
        onEvent?: (event: any) => void;
        onEose?: (relay: string) => void;
      }
    ): {
      unsub: () => void;
    };

    publish(
      relays: string[],
      event: any
    ): Promise<void[]>;

    list(
      relays: string[],
      filters: any[]
    ): Promise<any[]>;

    get(
      relays: string[],
      filter: any
    ): Promise<any | null>;

    close(relays?: string[]): void;

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
  export interface Event {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  }
}
