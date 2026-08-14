import type { Level } from './phrase.model';

/**
 * Một hội thoại mini 3-4 lượt để luyện phản xạ giao tiếp.
 * Chunk được tham chiếu bằng ID — 1 nguồn sự thật là collection `phrase_chunks`.
 */
export interface Scenario {
  id: string;          // 'scn-it-meet-a2-01'
  level: Level;
  context: string;     // 'meeting', 'small talk', 'cafe'...
  title: string;       // 'Mở đầu cuộc họp'
  tags?: string[];
  turns: ScenarioTurn[];
}

/** Đáp án hợp lệ: chunk-IDs theo thứ tự đúng. Object (không phải nested array) vì Firestore cấm array trong array. */
export interface ScenarioAnswer {
  ids: string[];
}

/** Một lượt: đối phương nói -> user ghép chunk trả lời -> hồi đáp scripted. */
export interface ScenarioTurn {
  speakerLine: string;      // câu thoại đối phương (phát TTS được)
  speakerLineVi?: string;
  answers: ScenarioAnswer[]; // đáp án hợp lệ; MỖI đáp án = array chunk-IDs theo thứ tự đúng
                             // answers[0] = đáp án tốt nhất; answers[1..] = 2-3 đáp án hợp lệ khác
  replyLine: string;        // hồi đáp scripted khi trả lời đúng
  replyLineVi?: string;
}
