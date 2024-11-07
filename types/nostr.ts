export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface AnimalKind extends NostrEvent {
  kind: 75757;
  content: string; // This will be the video URL
  tags: Array<['p', string] | ['e', string] | ['title', string]>; // p for author, e for reply
}

export interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

export interface NostrProfile extends NostrEvent {
  kind: 0;
  content: string; // JSON string of ProfileContent
}
