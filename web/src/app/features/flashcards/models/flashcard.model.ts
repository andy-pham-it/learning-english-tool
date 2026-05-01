export interface FlashcardData {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  exampleTranslation?: string;
  category: string;
}

export interface FlashcardProgress {
  id: string; // References FlashcardData.id
  repetition: number;
  interval: number;
  efactor: number;
  nextReviewDate: number; // Ticks as timestamp
}

export type FlashcardDeck = FlashcardData[];
