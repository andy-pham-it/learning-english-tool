export interface PatternData {
  id: string;
  category: string;
  example: string;
  vietnamese: string;
  pattern: string;
  structure: string;
  variables?: { [key: string]: string[] };
  usage: string;
  context?: string;
  examples?: { en: string; vi: string }[];
  keywords?: string[];
}

export interface PatternFillResult {
  slotName: string;
  value: string;
}
