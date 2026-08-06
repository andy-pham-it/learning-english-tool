import { PhraseChunk, Role } from './phrase.model';

describe('phrase model', () => {
  it('accepts the two new roles reaction and question', () => {
    const chunk: PhraseChunk = {
      id: 'x',
      domain: 'daily',
      context: 'small-talk',
      level: 'A2',
      english: 'that makes sense',
      vietnamese: 'hợp lý đấy',
      phonetic: '/ðæt meɪks sens/',
      role: 'reaction',
      examples: [{ en: 'That makes sense to me.', vi: 'Điều đó hợp lý với tôi.' }],
    };
    expect(chunk.role).toBe('reaction' as Role);
  });
});
