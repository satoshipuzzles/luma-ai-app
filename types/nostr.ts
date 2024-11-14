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
  tags: Array<['title' | 'r' | 'type' | 'e' | 'p', string]>;
}

export interface HistoryKind extends NostrEvent {
  kind: 8008135;
  tags: Array<['text-to-speech' | 'r' | 'e' | 'public', string]>;
}

export interface ProfileKind extends NostrEvent {
  kind: 0;
  content: string; // JSON string of profile data
}

export interface Profile {
  name?: string;
  picture?: string;
  about?: string;
  lud06?: string;  // LNURL
  lud16?: string;  // Lightning Address
  lnurl?: string;  // Added LNURL property
}

export interface VideoPost {
  event: AnimalKind;
  profile?: Profile;
  comments: Array<CommentPost>;
}

export interface CommentPost {
  event: AnimalKind;
  profile?: Profile;
}

export type NostrEventKind = AnimalKind | HistoryKind | ProfileKind;
