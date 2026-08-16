# M4 Speaking Chain Design Spec

> **Goal:** Thêm chế độ "Chuỗi nói" (Speaking Chain) — sinh 4–5 chunk cùng chủ đề, người học nối thành đoạn nói liền mạch ~30 giây, có đồng hồ đếm ngược, STT ghi lại đoạn nói, hiện đoạn mẫu để so sánh, và phản hồi tự động (đủ chunk / tốc độ / filler) dùng heuristic keyword spotting (không dùng Gemini).

## 1. UI & Flow
- **Tab mới "Chuỗi nói"** trong `PhraseLabPageComponent` (hoạt động khác hẳn luyện 1 câu → tách tab riêng).
- **Chọn chủ đề**: dropdown các `context` (tái dùng `PhraseContentService.contexts`).
- **Sinh 4–5 chunk** cùng chủ đề: `opener(1) + linker(2) + filler(1) + closer(1)` (tái dùng logic `pick` của `ConversationBuilderComponent`), hiển thị dạng chip có badge role.
- **Đồng hồ đếm ngược 30 giây**: bấm "▶ Bắt đầu" → đếm ngược → user nói tự do nối các chunk.
- **STT**: ghi lại đoạn nói qua `SpeechService.startListening`.
- **Đoạn mẫu (model passage)**: sau khi nói xong, hiện đoạn mẫu (ghép các chunk theo thứ tự tự nhiên) để so sánh.
- **Phản hồi tự động** (heuristic keyword spotting):
  - **Đủ chunk?**: chunk nào trong bộ mục tiêu xuất hiện trong transcript.
  - **Tốc độ?**: ước lượng từ/phút (WPM) từ transcript / thời gian.
  - **Có filler?**: phát hiện user có dùng filler chunk không.

## 2. Architecture & Component Changes
- **Component mới** `SpeakingChainComponent` (standalone, OnPush) + thêm tab vào `PhraseLabPageComponent`.
- **Tái dùng**: `PhraseContentService` (chunks/contexts), `SpeechService` (startListening/speak), `PhraseEngineService` (keyword spotting).
- **Helper mới**:
  - Sinh bộ chunk theo role (pick).
  - Dựng đoạn mẫu (nối `english` theo thứ tự tự nhiên).
  - Tính phản hồi: chunk coverage + WPM + filler detection.

## 3. Testing
- Unit test cho `SpeakingChainComponent` + các helper (sinh chunk, dựng đoạn mẫu, tính phản hồi).
