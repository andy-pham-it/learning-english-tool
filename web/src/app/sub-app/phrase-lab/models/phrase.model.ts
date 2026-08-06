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

export interface PhraseProgress {
  uid: string;
  masteredChunks: Record<string, { status: 'learning' | 'mastered'; speakScore: number; lastPracticed: number }>;
  masteredTemplates: Record<string, { bestSpeakScore: number; attempts: number }>;
  streak: { current: number; lastDay: string };
  totalPoints: number;
}
