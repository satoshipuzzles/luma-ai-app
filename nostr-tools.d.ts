// nostr-tools.d.ts

declare module 'nostr-tools/pool' {
  import { Event } from 'nostr-tools/event';
  import { Pub } from 'nostr-tools/relay';

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

    publish(relays: string[], event: Event): Pub[];

    list(relays: string[], filters: any[]): Promise<Event[]>;

    get(relays: string[], filter: any): Promise<Event | null>;

    close(relays?: string[]): void;

    // Add other methods as needed
  }
}

declare module 'nostr-tools/relay' {
  import { Event } from 'nostr-tools/event';

  export class Pub {
    on(type: 'ok' | 'seen' | 'failed', callback: () => void): void;
    off(type: 'ok' | 'seen' | 'failed', callback: () => void): void;
  }
}

declare module 'nostr-tools/event' {
  export interface Event {
    id?: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags?: string[][];
    content: string;
    sig?: string;
  }
}

declare module 'nostr-tools/pure' {
  import { Event } from 'nostr-tools/event';

  export function getEventHash(event: Event): string;
  export function validateEvent(event: Event): boolean;
  export function verifySignature(event: Event): boolean;
  export function signEvent(event: Event, privateKey: string): Event;

  // Add other functions and types as needed
}
