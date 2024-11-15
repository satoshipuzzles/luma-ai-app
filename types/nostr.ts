// types/nostr.ts

export interface AnimalKind {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

export interface Profile {
  name?: string;
  picture?: string;
  about?: string;
}

export interface VideoPost {
  event: AnimalKind;
  profile?: Profile;
  comments: AnimalKind[];
}
