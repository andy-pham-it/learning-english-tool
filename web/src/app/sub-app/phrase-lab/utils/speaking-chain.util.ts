import { PhraseChunk, Role } from '../models/phrase.model';

export interface SpeakingChainFeedback {
  covered: string[];
  missed: string[];
  wpm: number;
  fillers: string[];
}

const FILLER_WORDS = ['well', 'you know', 'actually', 'like', 'so', 'um', 'uh', 'i mean', 'basically', 'kind of'];

/**
 * Chọn chunk theo danh sách role, sort theo id và xoay vòng theo offset.
 * Mỗi phần tử trong `roles` chọn 1 chunk (cho phép lặp role để lấy nhiều chunk cùng role).
 */
export function pickChunks(pool: PhraseChunk[], roles: Role[], offset: number): PhraseChunk[] {
  const out: PhraseChunk[] = [];
  const roleIndex = new Map<Role, number>();
  for (const role of roles) {
    const cands = pool.filter((c) => c.role === role).sort((a, b) => a.id.localeCompare(b.id));
    if (!cands.length) {
      continue;
    }
    const idx = roleIndex.get(role) ?? 0;
    const start = (offset + idx) % cands.length;
    out.push(cands[start % cands.length]);
    roleIndex.set(role, idx + 1);
  }
  return out;
}

/** Nối các chunk theo thứ tự tự nhiên thành đoạn mẫu. */
export function buildModelPassage(chunks: PhraseChunk[]): string {
  return chunks.map((c) => c.english).join(' ');
}

/**
 * Heuristic keyword spotting: xác định chunk nào xuất hiện trong transcript,
 * ước tính WPM (số từ / thời gian giây * 60), và phát hiện filler.
 */
export function computeFeedback(
  targetChunks: PhraseChunk[],
  transcript: string,
  durationSec: number
): SpeakingChainFeedback {
  const lower = transcript.toLowerCase();
  const covered: string[] = [];
  const missed: string[] = [];
  for (const c of targetChunks) {
    if (matchesWord(c.english.toLowerCase(), lower)) {
      covered.push(c.id);
    } else {
      missed.push(c.id);
    }
  }
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const wpm = durationSec > 0 ? Math.round((wordCount / durationSec) * 60) : 0;
  const fillers = FILLER_WORDS.filter((f) => matchesWord(f, lower));
  return { covered, missed, wpm, fillers };
}

/** Khớp cụm từ ở ranh giới từ (không phải substring trong từ dài hơn). */
function matchesWord(phrase: string, text: string): boolean {
  return new RegExp(`\\b${escapeRegex(phrase)}\\b`).test(text);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
