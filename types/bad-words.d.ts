// types/bad-words.d.ts

declare module 'bad-words' {
  export default class Filter {
    constructor(options?: any);
    isProfane(word: string): boolean;
    clean(word: string, replacement?: string | ((char: string) => string)): string;
    addWords(...words: string[]): void;
    removeWords(...words: string[]): void;
  }
}
