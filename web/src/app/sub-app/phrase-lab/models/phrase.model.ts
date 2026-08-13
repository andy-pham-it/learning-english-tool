export type Role = 'opener' | 'linker' | 'filler' | 'closer' | 'reaction' | 'question';
export type Level = 'A2' | 'B1' | 'B2' | 'C1';

export interface PhraseChunk {
  id: string;
  domain: string;
  context: string;
  level: Level;
  english: string;
  vietnamese: string;
  phonetic: string;
  /** Ngữ cảnh áp dụng — giải thích chunk dùng trong tình huống nào (tiếng Việt). */
  usage?: string;
  role: Role;
  examples: { en: string; vi: string }[];
}

export interface PhraseTemplate {
  id: string;
  domain: string;
  context: string;
  level: Level;
  english: string;
  vietnamese: string;
  structure: string;
  slots: { name: string; role: Role | null; options?: string[] }[];
  example: { en: string; vi: string };
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: number;
}

export interface PhraseProgress {
  uid: string;
  masteredChunks: Record<string, { status: 'learning' | 'mastered'; speakScore: number; lastPracticed: number }>;
  masteredTemplates: Record<string, { bestSpeakScore: number; attempts: number }>;
  /** SM-2 scheduling state per chunk id. Absent = never scheduled (new chunk). */
  reviews: Record<string, ReviewState>;
  streak: { current: number; lastDay: string };
  totalPoints: number;
}
