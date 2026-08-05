# Phrase Lab Sub-App Design

> Sub-app học phrase & chunk cho The Hub ecosystem — luyện speak bằng cách tổ hợp các vế câu (chunk) thành câu phức, phân loại theo domain, ngữ cảnh và level.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────┐
│                 The Hub (InlayForgeKit)            │
│  ┌──────────────────────────────────────────────┐ │
│  │  Portal: /portal/phrase-lab                  │ │
│  │  ┌──────────────────────────────────────────┐│ │
│  │  │  <iframe sandbox="allow-scripts ...">    ││ │
│  │  │  ┌─────────────────────────────────────┐  ││ │
│  │  │  │  Phrase Lab Sub-App                 │  ││ │
│  │  │  │  (Angular standalone)               │  ││ │
│  │  │  │                                     │  ││ │
│  │  │  │  hub-auth (postMessage handshake)   │  ││ │
│  │  │  │    ├─ discoverHubOrigin()           │  ││ │
│  │  │  │    └─ requestUserInfo() → uid       │  ││ │
│  │  │  │                                     │  ││ │
│  │  │  │  Firebase (Firestore riêng dự án)   │  ││ │
│  │  │  │    ├─ phrase_chunks (public read)   │  ││ │
│  │  │  │    ├─ phrase_templates (public read)│  ││ │
│  │  │  │    └─ phrase_progress/{uid} (private)│ ││ │
│  │  │  └─────────────────────────────────────┘  ││ │
│  │  └──────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Key Decisions

- **Sub-app chạy trong same project (learning-english-tool)**, deploy qua Vercel, route `/sub-app/phrase-lab`
- **Content (chunks + templates) lưu trong Firestore** (user chọn approach B), public read như collection `dictionary`
- **Progress lưu trong Firestore riêng của dự án**, doc key = uid từ Hub auth handshake
- **Auth qua Hub**: tái sử dụng parent-origin discovery handshake (đã build cho dictionary sub-app), tách thành `hub-auth.service` dùng chung
- **Không dùng MainLayout / auth guard** — standalone component trong iframe
- **Zero-cost mitigation**: content collections được cache vào localStorage sau lần fetch đầu (TTL 24h)

---

## 2. Data Model (Firestore)

### Collection `phrase_chunks` — kho chunk/phrase (content, public read)

```typescript
interface PhraseChunk {
  id: string;                    // 'it-chunk-001'
  domain: 'IT' | 'Business' | 'Daily' | string;  // mở rộng được
  context: string;               // 'meeting' | 'email' | 'negotiation' | 'small-talk' | ...
  level: 'A2' | 'B1' | 'B2' | 'C1';
  english: string;               // 'take into consideration'
  vietnamese: string;            // 'cân nhắc, xem xét'
  phonetic: string;              // IPA: '/teɪk ɪntə kənˌsɪdəˈreɪʃən/'
  role: 'opener' | 'linker' | 'filler' | 'closer';
  examples: { en: string; vi: string }[];
}
```

### Collection `phrase_templates` — khuôn câu phức (content, public read)

```typescript
interface PhraseTemplate {
  id: string;                    // 'tpl-001'
  domain: string;
  context: string;
  level: 'A2' | 'B1' | 'B2' | 'C1';
  english: string;               // câu mẫu hoàn chỉnh
  vietnamese: string;
  structure: string;             // 'It would be better if {subject} {modal} {chunk:linker} the {noun}.'
  slots: {
    name: string;                // 'subject' | 'modal' | 'linker' | 'noun'
    role: Role | null;           // nếu có role → lấy giá trị từ phrase_chunks cùng domain+level
    options?: string[];          // options tĩnh khi role = null
  }[];
  example: { en: string; vi: string };
}
```

### Collection `phrase_progress` — tiến độ user (private, doc key = uid)

```typescript
interface PhraseProgress {
  uid: string;
  masteredChunks: Record<string, {
    status: 'learning' | 'mastered';
    speakScore: number;          // điểm tốt nhất 0-100
    lastPracticed: number;       // timestamp
  }>;
  masteredTemplates: Record<string, {
    bestSpeakScore: number;
    attempts: number;
  }>;
  streak: { current: number; lastDay: string };  // 'YYYY-MM-DD'
  totalPoints: number;
}
```

### Firestore Rules

```
match /phrase_chunks/{id}    { allow read: if true; }
match /phrase_templates/{id} { allow read: if true; }
match /phrase_progress/{uid} { allow read, write: if request.auth.uid == uid; }
```

---

## 3. Directory Structure

```
web/src/app/sub-app/phrase-lab/
├── pages/
│   └── phrase-lab-page.component.ts     # Shell: tabs 4 chế độ + header domain/context/level
├── components/
│   ├── chunk-browser.component.ts       # Lọc domain → context → level, danh sách chunk
│   ├── chunk-card.component.ts          # IPA, nghĩa, role badge, example, nút TTS
│   ├── sentence-analysis.component.ts   # Phân tích câu mẫu, tô màu theo role
│   ├── sentence-builder.component.ts    # Slot-filling theo template (kế thừa buildSentence)
│   ├── role-combiner.component.ts       # Chọn chunk theo role → ghép câu hợp lệ
│   ├── order-arrange.component.ts       # Sắp xếp chunk bị xáo trộn
│   └── speak-practice.component.ts      # Mic STT chấm câu + TTS nghe mẫu
├── models/
│   └── phrase.model.ts                  # PhraseChunk, PhraseTemplate, Slot, PhraseProgress, Role
├── services/
│   ├── phrase-content.service.ts        # Fetch Firestore + cache localStorage 24h
│   ├── phrase-progress.service.ts       # Đọc/ghi progress theo uid
│   └── phrase-engine.service.ts         # buildSentence, combineByRole, validateOrder, chấm STT
└── (auth: sub-app/auth/hub-auth.service.ts — dùng chung)
```

`web/src/app/sub-app/auth/hub-auth.service.ts` (mới, dùng chung):
- `discoverHubOrigin(): Observable<string | null>` — postMessage tới parent với targetOrigin `'*'`, adopt event.origin của reply khớp requestId + `typeof ok === 'boolean'`; fallback `?hub=` param → document.referrer
- `requestUserInfo(): Observable<{id, email, name, image} | null>` — 10s timeout, trả null khi fail
- Dictionary sub-app sẽ migrate sang service này ở đợt sau (out of scope v1)

---

## 4. Learning Flow

**Vòng học 3 bước:**

### Bước 0 — Browse
`chunk-browser`: lọc `domain → context → level`, danh sách chunk với IPA + role badge (màu: opener=xanh, linker=tím, filler=cam, closer=xanh lá).

### Bước 1 — Học chunk
`chunk-card`: nghĩa, IPA, example + dịch, nút 🔊 TTS nghe mẫu (Web Speech API). Bấm "Đã học" → ghi progress.

### Bước 2 — Luyện tổ hợp (4 chế độ, cùng 1 template)

| Chế độ | Cơ chế | Nguồn |
|---|---|---|
| **Phân tích câu mẫu** | Hiện template + tô màu thành phần theo role, chú thích vai trò từng chunk | `phrase_templates` |
| **Slot-filling** | Điền `{subject}`, `{modal}`, `{chunk:linker}` từ options → `buildSentence()` (kế thừa pattern.service) | template slots |
| **Role-combiner** | Chọn 1 chunk mỗi role từ `phrase_chunks` → engine kiểm tra cùng domain+level → ghép câu | engine |
| **Order-arrange** | Chunk xáo trộn → xếp đúng thứ tự → `validateOrder()` so template structure | engine |

### Bước 3 — Speak practice (trên câu đã tổ hợp)
1. 🔊 TTS đọc câu mẫu chậm.
2. 🎤 User bấm mic đọc lại → Web Speech API STT (pattern từ `speaking-drill`).
3. **Chấm điểm**: so transcript với câu mẫu → tỷ lệ khớp từ → 0-100 + feedback PERFECT!/Almost/Try again + highlight từ sai.
4. Điểm ≥ 80 → chunk/template `mastered`, streak +1 (tối đa 1/ngày).
5. Điểm thấp → đề xuất luyện lại, TTS chậm hơn.

### Error Handling
- Firestore fetch fail → fallback cache cũ + banner "đang dùng dữ liệu offline"
- Hub auth timeout 10s → progress local tạm, không chặn học
- STT không khả dụng → ẩn nút mic, gợi ý tự chấm

---

## 5. Data Seeding

- **Script**: `web/scripts/seed-phrase-lab.ts` (node, firebase-admin hoặc REST) — push thủ công
- **Seed v1**:
  - Kế thừa + mở rộng `b2_chunks_it.json` (5 chunk sẵn → thêm `role`, `context`, `phonetic`)
  - Tối thiểu **2 domain × 3 context × 2 level** × 8-10 chunk/context + 2-3 template/context
  - ≈ 60 chunk + 20 template cho v1
  - Nguồn nội dung: viết dựa trên pattern IT hiện có + business/daily phổ biến; **user review trước khi seed**

---

## 6. Testing

- **Unit (Karma — convention dự án)**:
  - `phrase-engine.service.spec.ts`: buildSentence, combineByRole (chỉ ghép cùng domain+level), validateOrder, scoring STT (mock SpeechRecognition)
  - `phrase-content.service.spec.ts`: cache hit/miss (fake localStorage)
  - `phrase-progress.service.spec.ts`: write-only-own-doc
- **Component smoke**: chunk-card render, builder fill → câu đúng
- **Manual**: seed Firestore → mở qua Hub → 4 chế độ → speak chấm điểm → progress lưu → reload thấy mastered

---

## 7. Out of Scope (v1)

- Không streak/points UI phức tạp (chỉ lưu field, UI sau)
- Không gamification (badge, leaderboard)
- Không AI sinh câu (approach C đã loại)
- Không migrate dictionary sub-app sang hub-auth.service trong đợt này (tách service nhưng chỉ sub-app mới dùng)

---

## 8. Open Questions

- Vị trí file Firestore rules trong repo (sẽ rà khi triển khai)
- Ngôn ngữ IPA cho business/daily chunk: chuẩn nguồn nào (sẽ xác định khi viết seed content)
