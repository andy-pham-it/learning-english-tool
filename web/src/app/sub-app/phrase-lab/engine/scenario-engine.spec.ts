import { buildTurnPool, checkAnswer, pickScenario } from './scenario-engine';
import type { Level, PhraseChunk, Role } from '../models/phrase.model';
import type { Scenario, ScenarioTurn } from '../models/scenario.model';

describe('scenario-engine', () => {
  const chunk = (
    id: string,
    level: Level = 'A2',
    context = 'meeting',
    english = `chunk ${id}`,
    role: Role = 'opener'
  ): PhraseChunk => ({
    id,
    domain: 'it',
    context,
    level,
    english,
    vietnamese: 'nghĩa tiếng Việt',
    phonetic: '',
    role,
    examples: [],
  });

  const turn = (answers: string[][]): ScenarioTurn => ({
    speakerLine: 'Hello, how are you?',
    answers: answers.map((ids) => ({ ids })),
    replyLine: 'Thanks!',
  });

  it('pickScenario trả null khi danh sách rỗng', () => {
    expect(pickScenario([])).toBeNull();
  });

  it('pickScenario lọc theo level', () => {
    const scenarios: Scenario[] = [
      { id: 'a', level: 'A2', context: 'm', title: 't', turns: [turn([['x']])] },
      { id: 'b', level: 'B1', context: 'm', title: 't', turns: [turn([['x']])] },
    ];
    const picked = pickScenario(scenarios, { level: 'B1' });
    expect(picked?.id).toBe('b');
  });

  it('pickScenario không lọc khi không truyền level', () => {
    const scenarios: Scenario[] = [
      { id: 'a', level: 'A2', context: 'm', title: 't', turns: [turn([['x']])] },
      { id: 'b', level: 'B1', context: 'm', title: 't', turns: [turn([['x']])] },
    ];
    expect(['a', 'b']).toContain(pickScenario(scenarios)?.id ?? '');
  });

  it('buildTurnPool chứa đủ chunk đáp án + 4-5 distractor, không trùng', () => {
    const chunks = new Map<string, PhraseChunk>([
      ['ans1', chunk('ans1')],
      ['ans2', chunk('ans2')],
      ['dis1', chunk('dis1')],
      ['dis2', chunk('dis2')],
      ['dis3', chunk('dis3')],
      ['dis4', chunk('dis4')],
      ['dis5', chunk('dis5')],
      ['dis6', chunk('dis6')],
      ['dis7', chunk('dis7')],
      ['dis8', chunk('dis8')],
      ['dis9', chunk('dis9')],
      ['dis10', chunk('dis10')],
    ]);
    const t = turn([['ans1', 'ans2']]);
    const pool = buildTurnPool(t, chunks);
    const ids = pool.map((o: any) => o.id);
    expect(ids).toContain('ans1');
    expect(ids).toContain('ans2');
    expect(ids.length).toBeGreaterThanOrEqual(6);
    expect(ids.length).toBeLessThanOrEqual(7);
    expect(new Set(ids).size).toBe(ids.length); // không trùng
  });

  it('buildTurnPool distractor cùng level và ưu tiên cùng role', () => {
    const chunks = new Map<string, PhraseChunk>([
      ['ans1', chunk('ans1', 'B1', 'meeting', 'a very long answer chunk', 'closer')],
      ['dis-close', chunk('dis-close', 'B1', 'meeting', 'another closing phrase', 'closer')],
      ['dis-open', chunk('dis-open', 'B1', 'meeting', 'an opening phrase', 'opener')],
      ['dis-a2', chunk('dis-a2', 'A2', 'meeting', 'short answer', 'opener')],
    ]);
    const pool = buildTurnPool(turn([['ans1']]), chunks);
    const ids = pool.map((o: any) => o.id);
    expect(ids).toContain('dis-close'); // cùng level + cùng role được ưu tiên
    expect(ids).not.toContain('dis-a2'); // khác level bị loại
  });

  it('buildTurnPool bỏ chunk không resolve + warn', () => {
    const chunks = new Map<string, PhraseChunk>([['ans1', chunk('ans1')]]);
    spyOn(console, 'warn');
    const pool = buildTurnPool(turn([['ans1', 'missing-id']]), chunks);
    expect(pool.map((o: any) => o.id)).not.toContain('missing-id');
    expect(console.warn).toHaveBeenCalled();
  });

  it('checkAnswer đúng theo thứ tự chính xác', () => {
    const t = turn([['a', 'b']]);
    expect(checkAnswer(['a', 'b'], t)).toEqual({ correct: true, matchedAnswer: ['a', 'b'] });
    expect(checkAnswer(['b', 'a'], t).correct).toBe(false);
    expect(checkAnswer(['a'], t).correct).toBe(false);
    expect(checkAnswer(['a', 'b', 'c'], t).correct).toBe(false);
  });

  it('checkAnswer khớp bất kỳ đáp án hợp lệ', () => {
    const t = turn([['a', 'b'], ['a']]);
    expect(checkAnswer(['a'], t)).toEqual({ correct: true, matchedAnswer: ['a'] });
  });

  it('buildTurnPool returns empty pool when no answer chunk resolves', () => {
    const chunks = new Map<string, PhraseChunk>([['dis1', chunk('dis1')]]);
    const pool = buildTurnPool(turn([['missing1'], ['missing2']]), chunks);
    expect(pool).toEqual([]);
  });
});
