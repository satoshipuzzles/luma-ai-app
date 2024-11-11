// nostr-tools.d.ts
declare module 'nostr-tools' {
  interface SimplePool {
    subscribe(relays: string[], filters: any[], opts?: any): any;
  }
}
