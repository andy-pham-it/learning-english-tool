import type { Level, PhraseChunk } from '../models/phrase.model';
import type { Scenario, ScenarioTurn } from '../models/scenario.model';

export interface ChunkOption {
  id: string;
  english: string;
  vietnamese: string;
  role: string;
}

export interface AnswerCheck {
  correct: boolean;
  matchedAnswer?: string[];
}

const MAX_DISTRACTORS = 5;

/**
 * Chọn ngẫu nhiên một scenario; lọc theo level nếu truyền opts.level.
 * Trả null nếu không có scenario khớp.
 */
export function pickScenario(
  scenarios: Scenario[],
  opts?: { level?: Level }
): Scenario | null {
  const pool = opts?.level
    ? scenarios.filter((s) => s.level === opts.level)
    : scenarios;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Xây pool gợi ý cho MỘT lượt: union chunk-ID của tất cả answers
 * + 4-5 distractor (cùng level, length english trong ±30% của answer chunks,
 * ưu tiên cùng role) — rồi shuffle. Chunk ID không resolve được -> bỏ + warn.
 */
export function buildTurnPool(
  turn: ScenarioTurn,
  chunks: Map<string, PhraseChunk>
): ChunkOption[] {
  const answerIds = new Set(turn.answers.flatMap((a) => a.ids));
  const answerChunks: PhraseChunk[] = [];
  for (const id of answerIds) {
    const c = chunks.get(id);
    if (c) answerChunks.push(c);
    else console.warn(`[scenario-engine] unresolved chunk id: ${id}`);
  }
  if (answerChunks.length === 0) {
    return [];
  }
  const lens = answerChunks.map((c) => c.english.length);
  const minLen = lens.length ? Math.min(...lens) * 0.7 : 0;
  const maxLen = lens.length ? Math.max(...lens) * 1.3 : Number.POSITIVE_INFINITY;
  const answerLevel = answerChunks[0]?.level;
  const answerRoles = new Set(answerChunks.map((c) => c.role));

  const candidates: PhraseChunk[] = [];
  for (const c of chunks.values()) {
    if (answerIds.has(c.id)) continue;
    if (answerLevel && c.level !== answerLevel) continue;
    if (c.english.length < minLen || c.english.length > maxLen) continue;
    candidates.push(c);
  }
  const score = (c: PhraseChunk): number => (answerRoles.has(c.role) ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a) || Math.random() - 0.5);
  const distractors = candidates.slice(0, MAX_DISTRACTORS);

  const options: ChunkOption[] = [...answerChunks, ...distractors].map((c) => ({
    id: c.id,
    english: c.english,
    vietnamese: c.vietnamese,
    role: c.role,
  }));
  return shuffle(options);
}

/**
 * So sánh sequence theo thứ tự với TỪNG answer hợp lệ.
 * Đúng nếu khớp bất kỳ answer nào (cùng độ dài + đúng thứ tự từng ID).
 */
export function checkAnswer(
  selectedIds: string[],
  turn: ScenarioTurn
): AnswerCheck {
  for (const answer of turn.answers) {
    const ids = answer.ids;
    if (ids.length !== selectedIds.length) continue;
    if (ids.every((id, i) => id === selectedIds[i])) {
      return { correct: true, matchedAnswer: ids };
    }
  }
  return { correct: false };
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
