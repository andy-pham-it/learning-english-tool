# M5 Speaking Streak & XP Integration Design Spec

> **Goal:** Nối mọi chế độ speaking (M1–M4) vào hệ streak/XP/rank đã có, thêm mục tiêu nói hằng ngày và hiển thị trạng thái đạt/chưa đạt trong UI.

## 1. Data Model & Service Changes (`UserProfileService`)
- Thêm 2 trường vào `UserProfile`:
  - `speakingSessions: number` — số buổi nói đạt (score ≥ 80).
  - `lastSpeakDate: string` — ngày nói đạt gần nhất (YYYY-MM-DD).
- Mở rộng `recordActivity(type)` để nhận thêm loại `'speaking'`:
  - Tăng `speakingSessions` lên 1.
  - Gán `lastSpeakDate = today`.
  - Cập nhật streak chung (cùng logic hiện có: lastActive===yesterday → streak+1; lastActive!==today → streak=1).

## 2. Phrase Lab Integration (`PhraseProgressService`)
- Trong `recordSpeakResult`, khi `score >= 80`:
  - Gọi `recordActivity('speaking')` để đẩy vào streak chung + tăng `speakingSessions`.
  - Giữ nguyên phần thưởng XP (10 XP) hiện có.
- **Xóa bỏ streak riêng rời** của Phrase Lab (`p.streak {current,lastDay}`) — code chết, không hiển thị ở đâu.

## 3. UI — Daily Speaking Goal Status
- Trong header bar (`bottom-nav.component.ts`, nơi đã hiện streak/XP/rank), thêm chỉ báo nhỏ:
  - **"🎯 Nói: Đã đạt ✓"** nếu `lastSpeakDate === today`.
  - **"🎯 Nói: Chưa đạt"** nếu ngược lại.
- Không có push notification.

## 4. Testing
- Unit tests cho `UserProfileService.recordActivity('speaking')` (tăng speakingSessions, set lastSpeakDate, cập nhật streak chung).
- Unit tests cho `PhraseProgressService.recordSpeakResult` (score ≥ 80 → gọi recordActivity('speaking'); xóa logic streak riêng).
- Unit tests cho `BottomNavComponent` (hiển thị trạng thái đạt/chưa đạt).
