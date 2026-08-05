import { Injectable } from '@angular/core';
import { PhraseChunk, PhraseTemplate, Role } from '../models/phrase.model';

export interface SpeakResult {
  score: number;
  wrongWords: string[];
}

@Injectable({ providedIn: 'root' })
export class PhraseEngineService {
  buildSentence(template: PhraseTemplate, fills: { name: string; value: string }[]): string {
    let sentence = template.structure;
    for (const fill of fills) {
      sentence = sentence.replace(
        new RegExp(`\\{chunk:${fill.name}\\}|\\{${fill.name}\\}`, 'g'),
        fill.value
      );
    }
    sentence = sentence.replace(/\{[^}]+\}/g, '___');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (!sentence.endsWith('?') && !sentence.endsWith('.')) {
      sentence += '.';
    }
    return sentence;
  }

  combineByRole(
    template: PhraseTemplate,
    chunks: PhraseChunk[],
    selection: Record<string, string>
  ): { sentence: string | null; errors: string[] } {
    const errors: string[] = [];
    const fills: { name: string; value: string }[] = [];
    for (const slot of template.slots) {
      if (slot.role) {
        const chunkId = selection[slot.name];
        const chunk = chunkId ? chunks.find((c) => c.id === chunkId) : undefined;
        if (!chunk) {
          errors.push(`Vai trò "${slot.role}" chưa được chọn`);
          continue;
        }
        if (chunk.role !== slot.role) {
          errors.push(`"${chunk.english}" không phải vai trò ${slot.role}`);
          continue;
        }
        if (chunk.domain !== template.domain || chunk.context !== template.context || chunk.level !== template.level) {
          errors.push(`"${chunk.english}" không thuộc ${template.domain}/${template.context}/${template.level}`);
          continue;
        }
        fills.push({ name: slot.name, value: chunk.english });
      } else {
        fills.push({ name: slot.name, value: slot.options?.[0] ?? '' });
      }
    }
    if (errors.length > 0) return { sentence: null, errors };
    return { sentence: this.buildSentence(template, fills), errors };
  }

  expectedSequence(template: PhraseTemplate, chunks: PhraseChunk[]): string[] {
    const fills = new Map<string, string>();
    for (const slot of template.slots) {
      if (slot.role) {
        const match = chunks.find(
          (c) => c.role === slot.role && c.domain === template.domain && c.context === template.context && c.level === template.level
        );
        fills.set(slot.name, match?.english ?? `{${slot.name}}`);
      } else {
        fills.set(slot.name, slot.options?.[0] ?? '');
      }
    }
    const seq: string[] = [];
    const re = /\{chunk:(\w+)\}|\{(\w+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template.structure)) !== null) {
      const name = m[1] ?? m[2];
      const value = fills.get(name);
      if (value) seq.push(value);
    }
    return seq;
  }

  validateOrder(
    template: PhraseTemplate,
    chunks: PhraseChunk[],
    sequence: string[]
  ): { correct: boolean; positionErrors: number[] } {
    const expected = this.expectedSequence(template, chunks);
    const positionErrors: number[] = [];
    const maxLen = Math.max(expected.length, sequence.length);
    for (let i = 0; i < maxLen; i++) {
      if (expected[i] !== sequence[i]) positionErrors.push(i);
    }
    return { correct: positionErrors.length === 0, positionErrors };
  }

  annotateStructure(template: PhraseTemplate): { text: string; role: Role | null }[] {
    const roleBySlot = new Map<string, Role | null>();
    for (const slot of template.slots) roleBySlot.set(slot.name, slot.role);
    const parts: { text: string; role: Role | null }[] = [];
    const re = /\{chunk:(\w+)\}|\{(\w+)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template.structure)) !== null) {
      if (m.index > last) parts.push({ text: template.structure.slice(last, m.index), role: null });
      const name = m[1] ?? m[2];
      parts.push({ text: `[${name}]`, role: roleBySlot.get(name) ?? null });
      last = m.index + m[0].length;
    }
    if (last < template.structure.length) parts.push({ text: template.structure.slice(last), role: null });
    return parts;
  }

  private normalizeWords(s: string): string[] {
    return s.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
  }

  scoreSpeech(target: string, transcript: string): SpeakResult {
    const t = this.normalizeWords(target);
    const u = this.normalizeWords(transcript);
    if (t.length === 0) return { score: 0, wrongWords: [] };
    const set = new Set(u);
    let matched = 0;
    for (const w of t) if (set.has(w)) matched++;
    const score = Math.round((matched / t.length) * 100);
    const wrongWords = t.filter((w) => !set.has(w));
    return { score, wrongWords };
  }
}
