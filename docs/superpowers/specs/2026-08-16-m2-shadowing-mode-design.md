# M2 Shadowing Mode (TTS Speed + Word Coverage % + Recording Replay) Design Spec

> **Goal:** Thêm chế độ Shadowing hoàn chỉnh vào `SpeakPracticeComponent` trong Phrase Lab: TTS đọc câu ở tốc độ tùy chọn → user lặp lại ngay → so khớp transcript để hiển thị % từ xuất hiện đúng → ghi âm để nghe lại so sánh với TTS chuẩn (self-assessment).

## 1. Luồng tương tác (từng bước)
1. User chọn tốc độ đọc: **🐢 Chậm / ▶ Normal / ⚡ Nhanh** (map `speechSynthesis.rate`: 0.7 / 1.0 / 1.3).
2. Bấm **"▶ Nghe"** → TTS đọc câu tiếng Anh (`target()`) ở tốc độ đã chọn.
3. Bấm **"🎤 Lặp lại"** → STT bắt giọng user lặp lại.
4. Hệ thống so khớp transcript với `target()` → hiển thị **% từ xuất hiện đúng** (word coverage).
5. Đồng thời **ghi âm** phiên lặp lại để user **nghe lại** so sánh với TTS chuẩn.
6. Feedback trực quan: % cao → xanh, trung bình → vàng, thấp → đỏ; liệt kê từ chưa nhận diện.

## 2. Architecture & Component Changes
- **`SpeechService`** (web/src/app/core/services/speech.service.ts):
  - Sửa `speak(text, lang, rate?)`: thêm tham số `rate` (mặc định giữ 0.9), dùng `utterance.rate = rate ?? 0.9`.
- **`SpeakPracticeComponent`**:
  - Thêm signal `shadowSpeed = signal<'slow'|'normal'|'fast'>('normal')`.
  - Thêm signal `shadowStep = signal<'idle'|'listening'|'done'>('idle')`.
  - Thêm signal `shadowScore = signal<number|null>(null)`.
  - Thêm method `playShadow()`: gọi `speech.speak(target(), 'en-US', rate)` với rate theo `shadowSpeed`.
  - Thêm method `repeatShadow()`: bật ghi âm + STT (`startListening`) → `scoreSpeech(target, transcript)` → set `shadowScore` + `shadowStep='done'`.
  - Tận dụng cơ chế ghi âm `MediaRecorder` đã có sẵn.
- **Không cần service mới** — tận dụng `SpeechService`, `PhraseEngineService.scoreSpeech`, cơ chế ghi âm hiện có.

## 3. Xử lý câu dài (C1)
- Giữ nguyên câu, cho phép nghe lại không giới hạn. Không chia nhỏ cụm trong M2 (giữ scope gọn).

## 4. Testing
- Unit tests cho `SpeakPracticeComponent`:
  - Test đổi tốc độ shadow (`shadowSpeed`).
  - Test `playShadow()` gọi `speech.speak` với rate đúng theo tốc độ.
  - Test `repeatShadow()` chấm điểm và set `shadowScore` + `shadowStep='done'`.
  - Test ghi âm + nghe lại trong shadow mode.
- Unit test cho `SpeechService.speak` rate param (nếu có spec hiện có).
