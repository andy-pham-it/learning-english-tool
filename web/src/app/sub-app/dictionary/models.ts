export interface DictionaryResult {
  word: string;
  phonetic?: string;
  entries: DictionaryEntry[];
  collocations: Collocation[];
  error?: string;
}

export interface DictionaryEntry {
  partOfSpeech: string;
  definitions: Definition[];
}

export interface Definition {
  en: string;
  vi: string;
  example?: string;
  exampleVi?: string;
}

export interface Collocation {
  phrase: string;
  meaning: string;
  exampleEn: string;
  exampleVi: string;
}

export interface VocabItem {
  note: string;
  savedAt: number;
}
