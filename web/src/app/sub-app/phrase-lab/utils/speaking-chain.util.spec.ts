import { pickChunks, buildModelPassage, computeFeedback } from './speaking-chain.util';
import { PhraseChunk, Role } from '../models/phrase.model';

function chunk(id: string, role: Role, english: string): PhraseChunk {
  return {
    id,
    domain: 'it',
    context: 'meeting',
    level: 'B2',
    english,
    vietnamese: 'v',
    phonetic: '/p/',
    role,
    examples: [],
  };
}

describe('speaking-chain.util', () => {
  const pool: PhraseChunk[] = [
    chunk('a-opener', 'opener', 'Let me start by saying'),
    chunk('b-opener', 'opener', 'To begin with'),
    chunk('c-linker', 'linker', 'Moreover'),
    chunk('d-linker', 'linker', 'In addition'),
    chunk('e-filler', 'filler', 'you know'),
    chunk('f-closer', 'closer', 'To sum up'),
  ];

  describe('pickChunks', () => {
    it('picks one chunk per role in order', () => {
      const roles: Role[] = ['opener', 'linker', 'filler', 'closer'];
      const out = pickChunks(pool, roles, 0);
      expect(out.map((c) => c.role)).toEqual(['opener', 'linker', 'filler', 'closer']);
      expect(out.map((c) => c.id)).toEqual(['a-opener', 'c-linker', 'e-filler', 'f-closer']);
    });

    it('rotates by offset', () => {
      const roles: Role[] = ['opener'];
      const out = pickChunks(pool, roles, 1);
      expect(out[0].id).toBe('b-opener');
    });

    it('picks multiple chunks for repeated roles', () => {
      const roles: Role[] = ['linker', 'linker'];
      const out = pickChunks(pool, roles, 0);
      expect(out.map((c) => c.id)).toEqual(['c-linker', 'd-linker']);
    });
  });

  describe('buildModelPassage', () => {
    it('joins chunk english in order', () => {
      const passage = buildModelPassage([pool[0], pool[2], pool[4], pool[5]]);
      expect(passage).toBe('Let me start by saying Moreover you know To sum up');
    });
  });

  describe('computeFeedback', () => {
    it('marks covered and missed chunks', () => {
      const transcript = 'Let me start by saying Moreover you know';
      const fb = computeFeedback([pool[0], pool[2], pool[4], pool[5]], transcript, 10);
      expect(fb.covered).toEqual(['a-opener', 'c-linker', 'e-filler']);
      expect(fb.missed).toEqual(['f-closer']);
    });

    it('computes WPM from word count and duration', () => {
      const transcript = 'one two three four five six';
      const fb = computeFeedback([], transcript, 6);
      expect(fb.wpm).toBe(60);
    });

    it('detects filler usage', () => {
      const transcript = 'well you know actually I think so';
      const fb = computeFeedback([], transcript, 10);
      expect(fb.fillers).toContain('you know');
      expect(fb.fillers).toContain('well');
    });

    it('does not match a chunk whose english is a substring of a longer word', () => {
      const c = chunk('sub', 'filler', 'so');
      const fb = computeFeedback([c], 'sooner or later', 10);
      expect(fb.covered).toEqual([]);
      expect(fb.missed).toEqual(['sub']);
    });

    it('matches multi-word filler phrases as whole units', () => {
      const fb = computeFeedback([], 'I mean, basically it works', 10);
      expect(fb.fillers).toContain('i mean');
      expect(fb.fillers).toContain('basically');
    });

    it('does not flag a filler substring inside a word', () => {
      const fb = computeFeedback([], 'humbly album wellbeing', 10);
      expect(fb.fillers).toEqual([]);
    });
  });
});
