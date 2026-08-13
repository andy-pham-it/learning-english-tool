# Design: M3 — Conversation Response Practice ("Phản xạ")

Ngày: 2026-08-13. Trạng thái: **đã duyệt** (user, sau phản biện Hermes).

## Goal

Thêm tab "Phản xạ" vào Phrase Lab: user tiếp nhận câu thoại của đối phương, trả lời bằng cách ghép chunk từ pool gợi ý (nhiều hơn đáp án tốt nhất, có distractor), so sánh với đáp án hợp lệ, qua hội thoại mini 3-4 lượt. Chunk dùng sai tự về vòng ôn SM-2.

## Quyết định đã chốt (brainstorm 2026-08-13)

- **Chấm điểm**: mỗi lượt có 1 đáp án tốt nhất + 2-3 đáp án hợp lệ khác (đều dùng chunk trong pool); khớp bất kỳ đáp án hợp lệ = pass. Chấm offline tức thì, 0 chi phí. Gemini có thể gắn sau (ngoài scope).
- **Cấu trúc scenario**: đa lượt — hội thoại mini 3-4 lượt; đối phương nói → user ghép trả lời → đối phương hồi đáp scripted → lặp lại.
- **Tích hợp SM-2**: có — chunk dùng sai / bỏ cuộc ("Xem đáp án") về vòng ôn (again), chunk dùng đúng (good); hôm sau xuất hiện trong tab "Hôm nay".
- **Nguồn scenario**: MỘT nguồn duy nhất = Firestore (collection `phrase_scenarios`); viết seed script đổ ~20-30 scenario khởi đầu; KHÔNG bundle static JSON vào app. App đọc qua pattern `PhraseContentService` (cache localStorage 24h + offline fallback).
- **Approach kiến trúc**: mô-đun mới `scenario/` trong Phrase Lab — model + engine pure TS + service + component riêng; không đụng component/tab hiện có.
- **Micro-decisions (PRIME tự chốt)**: pool theo TỪNG lượt (chunk đáp án + 4-5 distractor, shuffle); so khớp order-sensitive theo chunk-id sequence; tab mới "Phản xạ"; audio qua `SpeechService.speak` (TTS có sẵn); scenario có level + context, lọc được level.

## Kiến trúc

```
web/src/app/sub-app/phrase-lab/
├── models/scenario.model.ts        # Scenario, ScenarioTurn
├── services/scenario.service.ts    # Firestore + cache localStorage 24h + offline (copy pattern PhraseContentService)
├── engine/scenario-engine.ts       # pure TS — không import Angular
└── components/response-practice.component.ts   # tab "Phản xạ"
```

## Data model — Firestore collection `phrase_scenarios`

```ts
interface Scenario {
  id: string;                  // 'scn-cafe-order-a2-01'
  level: 'A2' | 'B1' | 'B2' | 'C1';
  context: string;             // 'cafe', 'meeting'...
  title: string;               // 'Gọi món ở quán cà phê'
  tags?: string[];             // optional — phục vụ lọc sau này
  turns: ScenarioTurn[];       // 3-4 lượt
}

interface ScenarioTurn {
  speakerLine: string;         // câu thoại đối phương (phát TTS được)
  speakerLineVi?: string;      // bản dịch (toggle nghĩa)
  answers: string[][];         // đáp án hợp lệ; MỖI đáp án = array chunk-IDs theo thứ tự đúng
                               // answers[0] = đáp án tốt nhất; answers[1..] = 2-3 đáp án hợp lệ
  replyLine: string;           // hồi đáp scripted của đối phương khi trả lời đúng
  replyLineVi?: string;
}
```

- Chunk tham chiếu bằng **ID** (không nhúng nội dung) — 1 nguồn sự thật là `phrase_chunks` (1846+ chunk). Component resolve ID → `PhraseChunk` qua `PhraseContentService.loadAll()` (đã có, đã cache).
- Ràng buộc soạn nội dung: mọi đáp án trong `answers` dùng chunk có trong pool của lượt; các đáp án tương đương ngữ nghĩa để `replyLine` lượt sau vẫn hợp lý. **Content rule (sau phản biện Hermes)**: cụm từ nào có thể hoán đổi vị trí hợp lệ (vd trạng từ đầu/cuối câu) thì soạn giả phải liệt kê cả 2 thứ tự thành 2 đáp án riêng trong `answers[]` — engine giữ order-sensitive, không cần tree-matching.
- **Versioning (sau phản biện Hermes)**: collection có doc meta `phrase_scenarios/meta` chứa `{version: number}`. `ScenarioService` mỗi lần load đọc meta doc (1 read) + so với version đã cache trong localStorage (`phrase_lab_scenarios_version`); lệch → bỏ cache, refetch toàn bộ. Đảm bảo "thêm scenario không cần redeploy" hiện ra trong vòng vài giây thay vì chờ hết TTL 24h.

## Engine (`scenario-engine.ts`, pure TS)

```ts
pickScenario(scenarios: Scenario[], opts?: { level? }): Scenario;
// Chọn ngẫu nhiên, lọc level nếu có.

buildTurnPool(turn: ScenarioTurn, chunks: Map<string, PhraseChunk>): ChunkOption[];
// pool = union chunk-ID của tất cả answers + distractor
// distractor (sau phản biện Hermes): chunk ngẫu nhiên cùng level, KHÔNG thuộc answers, 4-5 cái,
//   ưu tiên cùng context; heuristic tránh "lộ đáp án" — chọn distractor có độ dài english trong
//   khoảng ±30% so với chunk đáp án, ưu tiên cùng role (bỏ qua POS tagging — quá nặng cho mục đích này)
// → shuffle. Chunk ID không resolve được → bỏ qua + console.warn (không crash).

checkAnswer(selectedIds: string[], turn: ScenarioTurn): { correct: boolean; matchedAnswer?: string[] };
// So sánh sequence theo thứ tự với TỪNG answer; đúng nếu khớp bất kỳ answer hợp lệ.
```

## Component — tab "Phản xạ" (`response-practice.component.ts`)

- **Màn hình bắt đầu**: chips lọc level (Tất cả/A2/B1/B2/C1) + nút "Bắt đầu" → `engine.pickScenario(scenarios, {level})`.
- **Luồng lượt**:
  - Bubble đối phương: `speakerLine` + 🔊 TTS (`SpeechService.speak`) + toggle "Nghĩa" → `speakerLineVi`.
  - Vùng ghép: chip chunk (đã shuffle từ pool); tap thêm vào câu trả lời, tap lại bỏ; câu đang ghép hiện theo thứ tự, mỗi chip có nút ×. Có nút "Xoá hết" (sau phản biện Hermes — tránh tap-to-remove từng chip khi muốn làm lại).
  - Nút "Kiểm tra" (active khi ≥1 chunk).
  - Đúng ✓: bubble xanh + hiện `replyLine` (🔊 + nghĩa) → nút "Tiếp tục".
  - Sai ✗: "Chưa đúng, thử lại" — giữ nguyên pool, KHÔNG hiện đáp án đúng ngay (rèn retrieval). Sau **2 lần sai liên tiếp** → nút "Xem đáp án" (hiện đáp án tốt nhất; không tính pass).
  - Hết lượt → summary: số lượt đúng ngay/tổng + danh sách chunk dùng sai → "Hoàn tất".

## Tích hợp SM-2 (`phrase-progress.reviewChunk(id, rating)`)

- Chunk trong câu trả lời đúng → `reviewChunk(id, 'good')`.
- Chunk trong câu trả lời sai → `reviewChunk(id, 'again')`.
- Chunk trong "Xem đáp án" (bỏ cuộc) → `reviewChunk(id, 'again')`, không tính pass.
- Chỉ gọi reviewChunk 1 lần/đáp án cuối cùng mỗi lượt (chunk user thực sự dùng) — tránh spam khi thử sai nhiều lần.

## Data flow

1. `ScenarioService.loadScenarios()` → Firestore `phrase_scenarios` → cache localStorage `phrase_lab_scenarios` + `_ts` (TTL 24h) + offline fallback signal — copy nguyên pattern `PhraseContentService`.
2. Component resolve chunk ID → `PhraseContentService.loadAll()`.
3. Mỗi lượt: `engine.buildTurnPool` → render → user tap → `engine.checkAnswer` → đúng/sai → replyLine / thử lại.
4. Kết thúc → `progress.reviewChunk` cho từng chunk dùng.

## Error handling

- Không load được scenario (offline lần đầu, chưa cache): message "Cần kết nối mạng lần đầu" + nút "Thử lại".
- Chunk ID không resolve (data lệch): engine bỏ qua + `console.warn`.
- TTS không hoạt động: `SpeechService.speak` tự fallback (không speechSynthesis → bỏ tiếng, text vẫn đọc được).
- Rời tab giữa chừng: không lưu gì, lần sau bắt đầu scenario mới.

## Testing

- **Engine (spec pure TS, không TestBed)**: `pickScenario` lọc level; `buildTurnPool` chứa đủ chunk đáp án + 4-5 distractor, không trùng, bị shuffle; `checkAnswer` — đúng thứ tự → đúng; thiếu/thừa/sai thứ tự → sai; khớp bất kỳ answer hợp lệ → đúng; chunk lạ → bỏ + warn.
- **ScenarioService**: spy `collection`/`getDocs` (pattern test PhraseContentService) — load, cache, offline.
- **Component fixture**: tap chips → submit đúng → hiện replyLine; submit sai → giữ pool + không tiến; 2 lần sai → "Xem đáp án"; summary cuối; `reviewChunk` gọi đúng rating.

## Seed script

- `web/scripts/seed-phrase-scenarios.ts` — theo pattern `seed-phrase-lab.ts` (firebase-admin + `GOOGLE_APPLICATION_CREDENTIALS`), NHƯNG chia batch ≤400 docs/đợt (Firestore giới hạn 500 ops/batch; script hiện tại với 1846+ chunks sẽ vượt).
- Data khởi đầu: ~20-30 scenario (từng level, nhiều context), đặt trong `web/scripts/seed-data/scenario-seed.data.ts` (export `SEED_SCENARIOS`).
- Chunk IDs trong scenario phải tồn tại trong `SEED_CHUNKS` (verify bằng script trước khi đổ).

## Out of scope (M3)

- STT/nói — thuộc M1 (text-first: click chọn, không mic).
- Gemini semantic scoring — gắn sau nếu cần.
- Analytics, onboarding hướng dẫn.
- UI mockup đẹp — mobile-first, theo style hiện có của Phrase Lab.

## Open questions

- (đã trả lời qua brainstorm) mic/browser: không cần — text-first.
- (đã trả lời) cái gì quyết định "đúng": nội dung + thứ tự, chấm offline nhiều đáp án hợp lệ.
- (đã trả lời) chi phí chấm: 0 (offline).
