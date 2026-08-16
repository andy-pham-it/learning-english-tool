# M1 Production Mode (Active Retrieval & STT Scoring) Design Spec

> **Goal:** Thêm chế độ Production Mode (Truy xuất chủ động từ nghĩa tiếng Việt sang tiếng Anh) tích hợp trực tiếp vào tab Luyện nói (`SpeakPracticeComponent`), giúp người học rèn luyện phản xạ nói mà không nhìn trước câu tiếng Anh.

## 1. Architecture & Component Changes
- **`SpeakPracticeComponent`**:
  - Thêm state `productionMode` (signal boolean, mặc định `false`).
  - Thêm state `showProductionAnswer` (signal boolean, mặc định `false`).
  - Khi `productionMode` bật:
    - Ẩn câu tiếng Anh (`target()`), hiển thị nghĩa tiếng Việt (`template.vietnamese` hoặc `template.example.vi`).
    - Hiển thị nút **"💡 Xem đáp án"** cho phép bật hiển thị câu tiếng Anh nếu người học quên (tự động gắn cờ review 'again' nếu bấm xem).
  - Tận dụng `SpeechService.startListening()` và `PhraseEngineService.scoreSpeech(target, transcript)` để chấm điểm câu user đọc.

## 2. Data Flow & Evaluation
1. Người học chọn template trong tab Luyện nói.
2. Bật toggle **"🎯 Production Mode"**.
3. Hệ thống hiển thị câu tiếng Việt (Active Retrieval prompt).
4. Người học nói câu tiếng Anh từ trí nhớ và bấm **"🎤 Đọc câu này"**.
5. STT trả về transcript → `scoreSpeech(target, transcript)` tính điểm (`score`, `wrongWords`).
6. Nếu `score >= 80` → PASS (hiện kết quả xanh, đánh dấu mastered). Nếu chưa đạt, hiện gợi ý hoặc cho phép xem đáp án.

## 3. Testing
- Unit tests cho `SpeakPracticeComponent`:
  - Test chuyển đổi qua lại giữa Normal Mode và Production Mode.
  - Test ẩn/hiện câu tiếng Anh khi bật Production Mode.
  - Test nút "💡 Xem đáp án" hoạt động đúng.
