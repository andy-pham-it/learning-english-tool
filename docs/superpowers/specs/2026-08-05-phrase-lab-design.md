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

## 8. Seed Content v1 — Danh sách chunk & template

> Nội dung seed được tác giả hóa để user review trước khi triển khai. Quy ước id: `{domain}-{context}-{level}-{nn}`.
> Level: B1 (cơ bản) / B2 (nâng cao). Role: opener / linker / filler / closer.
> `examples` cho mỗi chunk sẽ được sinh từ các template cùng context trong lúc seed (không author tay từng example).

### 8.1 Domain IT — context `meeting`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| it-meet-b1-01 | as you know | như bạn đã biết | /æz juː nəʊ/ | opener | B1 |
| it-meet-b1-02 | in my opinion | theo ý tôi | /ɪn maɪ əˈpɪnjən/ | opener | B1 |
| it-meet-b1-03 | let's move on | chúng ta chuyển tiếp nhé | /lets muːv ɒn/ | linker | B1 |
| it-meet-b1-04 | keep it simple | giữ cho đơn giản | /kiːp ɪt ˈsɪmpəl/ | closer | B1 |
| it-meet-b1-05 | to sum up | tóm lại | /tə sʌm ʌp/ | closer | B1 |
| it-meet-b2-01 | take into consideration | cân nhắc, xem xét | /teɪk ˈɪntə kənˌsɪdəˈreɪʃən/ | linker | B2 |
| it-meet-b2-02 | bear in mind | ghi nhớ, lưu ý | /beər ɪn maɪnd/ | linker | B2 |
| it-meet-b2-03 | I'd like to point out | tôi muốn chỉ ra | /aɪd laɪk tə pɔɪnt aʊt/ | opener | B2 |
| it-meet-b2-04 | from a technical standpoint | từ góc độ kỹ thuật | /frɒm ə ˈteknɪkəl ˈstændpɔɪnt/ | opener | B2 |
| it-meet-b2-05 | to be on the same page | thống nhất quan điểm | /tə bi ɒn ðə seɪm peɪdʒ/ | closer | B2 |

### 8.2 Domain IT — context `email`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| it-email-b1-01 | please find attached | vui lòng xem file đính kèm | /pliːz faɪnd əˈtætʃt/ | opener | B1 |
| it-email-b1-02 | in the meantime | trong lúc chờ đợi | /ɪn ðə ˈmiːntaɪm/ | linker | B1 |
| it-email-b1-03 | get back to me | phản hồi lại tôi | /ɡet bæk tə miː/ | closer | B1 |
| it-email-b1-04 | thanks in advance | cảm ơn trước | /θæŋks ɪn ədˈvɑːns/ | closer | B1 |
| it-email-b2-01 | for your reference | để bạn tham khảo | /fə jɔː ˈrefərəns/ | opener | B2 |
| it-email-b2-02 | with regard to | liên quan đến | /wɪð rɪˈɡɑːd tə/ | opener | B2 |
| it-email-b2-03 | I'll keep you posted | tôi sẽ cập nhật cho bạn | /aɪl kiːp juː ˈpəʊstɪd/ | closer | B2 |
| it-email-b2-04 | feel free to reach out | cứ thoải mái liên hệ | /fiːl friː tə riːtʃ aʊt/ | closer | B2 |

### 8.3 Domain IT — context `incident`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| it-inc-b2-01 | it's down | nó đang ngừng hoạt động | /ɪts daʊn/ | opener | B2 |
| it-inc-b2-02 | root cause analysis | phân tích nguyên nhân gốc | /ruːt kɔːz əˈnæləsɪs/ | filler | B2 |
| it-inc-b2-03 | to isolate the issue | cô lập vấn đề | /tə ˈaɪsəleɪt ði ˈɪʃuː/ | linker | B2 |
| it-inc-b2-04 | to bring it back up | khôi phục lại | /tə brɪŋ ɪt bæk ʌp/ | closer | B2 |
| it-inc-b2-05 | within the expected timeframe | trong khung thời gian dự kiến | /wɪˈðɪn ði ɪkˈspektɪd ˈtaɪmfreɪm/ | closer | B2 |

### 8.4 Domain Business — context `meeting`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| biz-meet-b1-01 | to kick things off | bắt đầu buổi họp | /tə kɪk θɪŋz ɒf/ | opener | B1 |
| biz-meet-b1-02 | on the agenda | trong chương trình nghị sự | /ɒn ði əˈdʒendə/ | filler | B1 |
| biz-meet-b1-03 | to go through | xem qua, đi qua | /tə ɡəʊ θruː/ | linker | B1 |
| biz-meet-b1-04 | at the end of the day | cuối cùng thì | /æt ði end əv ðə deɪ/ | closer | B1 |
| biz-meet-b2-01 | from a business perspective | từ góc độ kinh doanh | /frɒm ə ˈbɪznəs pəˈspektɪv/ | opener | B2 |
| biz-meet-b2-02 | to align on | thống nhất về | /tə əˈlaɪn ɒn/ | linker | B2 |
| biz-meet-b2-03 | moving forward | tiến tới, về phía trước | /ˈmuːvɪŋ ˈfɔːwəd/ | linker | B2 |
| biz-meet-b2-04 | to put it on hold | tạm gác lại | /tə pʊt ɪt ɒn həʊld/ | closer | B2 |

### 8.5 Domain Business — context `email`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| biz-email-b1-01 | I hope this finds you well | hy vọng bạn vẫn khỏe | /aɪ həʊp ðɪs faɪndz juː wel/ | opener | B1 |
| biz-email-b1-02 | just a quick follow-up | chỉ là một lần nhắc lại ngắn | /dʒʌst ə kwɪk ˈfɒləʊ ʌp/ | opener | B1 |
| biz-email-b1-03 | at your earliest convenience | khi nào bạn tiện | /æt jɔː ˈɜːliɪst kənˈviːniəns/ | closer | B1 |
| biz-email-b1-04 | looking forward to | rất mong | /ˈlʊkɪŋ ˈfɔːwəd tə/ | closer | B1 |
| biz-email-b2-01 | to touch base | trao đổi nhanh | /tə tʌtʃ beɪs/ | opener | B2 |
| biz-email-b2-02 | as per our conversation | theo đúng như cuộc trao đổi | /æz pɜː aʊə ˌkɒnvəˈseɪʃən/ | opener | B2 |
| biz-email-b2-03 | should you have any questions | nếu bạn có bất kỳ câu hỏi nào | /ʃʊd juː hæv ˈeni ˈkwestʃənz/ | closer | B2 |
| biz-email-b2-04 | I look forward to your reply | tôi mong nhận được hồi âm | /aɪ lʊk ˈfɔːwəd tə jɔː rɪˈplaɪ/ | closer | B2 |

### 8.6 Domain Business — context `negotiation`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| biz-neg-b2-01 | our bottom line is | giới hạn cuối cùng của chúng tôi là | /aʊə ˈbɒtəm laɪn ɪz/ | opener | B2 |
| biz-neg-b2-02 | on a tight budget | với ngân sách eo hẹp | /ɒn ə taɪt ˈbʌdʒɪt/ | filler | B2 |
| biz-neg-b2-03 | to meet us halfway | nhân nhượng nửa chừng | /tə miːt ʌs hɑːfˈweɪ/ | linker | B2 |
| biz-neg-b2-04 | to sweeten the deal | làm cho thương vụ hấp dẫn hơn | /tə ˈswiːtən ðə diːl/ | closer | B2 |
| biz-neg-b2-05 | to come to an agreement | đi đến thỏa thuận | /tə kʌm tə ən əˈɡriːmənt/ | closer | B2 |

### 8.7 Domain Daily — context `small-talk`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| day-st-b1-01 | how's it going | dạo này thế nào | /haʊz ɪt ˈɡəʊɪŋ/ | opener | B1 |
| day-st-b1-02 | long time no see | lâu rồi không gặp | /lɒŋ taɪm nəʊ siː/ | opener | B1 |
| day-st-b1-03 | by the way | nhân tiện | /baɪ ðə weɪ/ | linker | B1 |
| day-st-b1-04 | to catch up | hàn huyên, cập nhật chuyện | /tə kætʃ ʌp/ | closer | B1 |
| day-st-b2-01 | it's been a while | đã một thời gian rồi | /ɪts biːn ə waɪl/ | opener | B2 |
| day-st-b2-02 | speaking of which | nói đến chuyện đó | /ˈspiːkɪŋ əv wɪtʃ/ | linker | B2 |
| day-st-b2-03 | to keep things short | giữ cho ngắn gọn | /tə kiːp θɪŋz ʃɔːt/ | opener | B2 |
| day-st-b2-04 | let's pick this up later | để dành nói tiếp sau | /lets pɪk ðɪs ʌp ˈleɪtə/ | closer | B2 |

### 8.8 Domain Daily — context `opinion`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| day-op-b1-01 | as far as I know | theo như tôi biết | /æz fɑːr æz aɪ nəʊ/ | opener | B1 |
| day-op-b1-02 | to be honest | thành thật mà nói | /tə bi ˈɒnɪst/ | opener | B1 |
| day-op-b1-03 | in that case | trong trường hợp đó | /ɪn ðæt keɪs/ | linker | B1 |
| day-op-b1-04 | it depends on | nó phụ thuộc vào | /ɪt dɪˈpendz ɒn/ | filler | B1 |
| day-op-b2-01 | from my point of view | theo quan điểm của tôi | /frɒm maɪ pɔɪnt əv vjuː/ | opener | B2 |
| day-op-b2-02 | that said | dù vậy | /ðæt sed/ | linker | B2 |
| day-op-b2-03 | to weigh the pros and cons | cân nhắc ưu nhược điểm | /tə weɪ ðə prəʊz ənd kɒnz/ | linker | B2 |
| day-op-b2-04 | I couldn't agree more | tôi hoàn toàn đồng ý | /aɪ ˈkʊdnt əˈɡriː mɔː/ | closer | B2 |

### 8.9 Domain Daily — context `daily-work`

| id | english | vietnamese | phonetic (IPA) | role | level |
|---|---|---|---|---|---|
| day-work-b1-01 | first thing in the morning | việc đầu tiên buổi sáng | /fɜːst θɪŋ ɪn ðə ˈmɔːnɪŋ/ | opener | B1 |
| day-work-b1-02 | to run errands | chạy việc vặt | /tə rʌn ˈerəndz/ | filler | B1 |
| day-work-b1-03 | to call it a day | kết thúc ngày làm việc | /tə kɔːl ɪt ə deɪ/ | closer | B1 |
| day-work-b1-04 | to wrap things up | chốt lại mọi việc | /tə ræp θɪŋz ʌp/ | closer | B1 |
| day-work-b2-01 | to stay on top of | luôn nắm bắt, theo sát | /tə steɪ ɒn tɒp əv/ | linker | B2 |
| day-work-b2-02 | to push things forward | thúc đẩy công việc tiến lên | /tə pʊʃ θɪŋz ˈfɔːwəd/ | linker | B2 |
| day-work-b2-03 | to prioritize the tasks | ưu tiên các việc | /tə praɪˈɒrɪtaɪz ðə tɑːsks/ | filler | B2 |
| day-work-b2-04 | to get it done by | hoàn thành trước | /tə ɡet ɪt dʌn baɪ/ | closer | B2 |

### 8.10 Templates (mỗi context 2 template, slot `{chunk:role}` lấy từ chunks cùng domain+context+level)

**IT — meeting (B2)**
- `tpl-it-meet-01`: *"It would be better if {subject} {modal} {chunk:linker} the {noun} before we {verb}."* — EN mẫu: *"It would be better if we could take into consideration the system load before we proceed."* — VI: *"Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục."* — slots: `subject`[we,you,the team] `modal`[could,would] `linker`(role) `noun`[system load,performance,the requirements] `verb`[move on,proceed].
- `tpl-it-meet-02`: *"{chunk:opener} that {chunk:linker} the {noun} before we {verb}."* — EN mẫu: *"I'd like to point out that we should bear in mind the system load before we proceed."* — VI: *"Tôi muốn chỉ ra rằng chúng ta nên ghi nhớ tải hệ thống trước khi tiếp tục."* — slots: `opener`(role) `linker`(role) `noun`[the requirements, the deadline, the system load] `verb`[proceed, make a decision].

**IT — email (B2)**
- `tpl-it-email-01`: *"{chunk:opener} {noun} — {chunk:closer}."* — EN mẫu: *"For your reference, here is the report — I'll keep you posted on any updates."* — VI: *"Để bạn tham khảo, đây là báo cáo — tôi sẽ cập nhật cho bạn nếu có thay đổi."* — slots: `opener`(role) `noun`[here is the report, the updated docs, the meeting notes] `closer`(role).
- `tpl-it-email-02`: *"{chunk:opener} the {noun} — {chunk:closer}."* — EN mẫu: *"With regard to the incident — feel free to reach out if you have questions."* — VI: *"Liên quan đến sự cố — cứ thoải mái liên hệ nếu bạn có thắc mắc."* — slots: `opener`(role) `noun`[incident, deployment, migration] `closer`(role).

**IT — incident (B2)**
- `tpl-it-inc-01`: *"{chunk:opener} — we're doing {chunk:filler} to {chunk:closer} within {timeframe}."* — EN mẫu: *"It's down — we're doing root cause analysis to bring it back up within the expected timeframe."* — VI: *"Hệ thống đang ngừng hoạt động — chúng tôi đang phân tích nguyên nhân gốc để khôi phục trong khung thời gian dự kiến."* — slots: `opener`(role) `filler`(role) `closer`(role) `timeframe`[the hour, the expected timeframe, 2 hours].
- `tpl-it-inc-02`: *"We need to {chunk:linker} first, then {chunk:closer}."* — EN mẫu: *"We need to isolate the issue first, then bring it back up."* — VI: *"Chúng ta cần cô lập vấn đề trước, sau đó khôi phục."* — slots: `linker`(role) `closer`(role).

**Business — meeting (B2)**
- `tpl-biz-meet-01`: *"{chunk:opener}, {subject} should {verb} on this before we {chunk:closer}."* — EN mẫu: *"From a business perspective, we should align on this before we put it on hold."* — VI: *"Từ góc độ kinh doanh, chúng ta nên thống nhất về việc này trước khi tạm gác lại."* — slots: `opener`(role) `subject`[we, the team, management] `verb`[align, decide, discuss] `closer`(role).
- `tpl-biz-meet-02`: *"{chunk:linker}, let's {verb} {noun}."* — EN mẫu: *"Moving forward, let's go through the agenda."* — VI: *"Tiến tới, chúng ta hãy đi qua chương trình nghị sự."* — slots: `linker`(role) `verb`[go through, review, discuss] `noun`[the agenda, the budget, the timeline].

**Business — email (B2)**
- `tpl-biz-email-01`: *"{chunk:opener} — {chunk:closer}."* — EN mẫu: *"As per our conversation, I look forward to your reply."* — VI: *"Theo đúng như cuộc trao đổi, tôi mong nhận được hồi âm."* — slots: `opener`(role) `closer`(role).
- `tpl-biz-email-02`: *"{chunk:opener} the {noun} {chunk:closer}."* — EN mẫu: *"To touch base on the proposal — let me know at your earliest convenience."* — VI: *"Để trao đổi nhanh về đề xuất — cho tôi biết khi nào bạn tiện."* — slots: `opener`(role) `noun`[the proposal, the contract, the timeline] `closer`(role).

**Business — negotiation (B2)**
- `tpl-biz-neg-01`: *"{chunk:opener} {number} — can you {chunk:linker} on the {noun}?"* — EN mẫu: *"Our bottom line is 20% — can you meet us halfway on the price?"* — VI: *"Giới hạn cuối của chúng tôi là 20% — bạn có thể nhân nhượng nửa chừng về giá không?"* — slots: `opener`(role) `number`[20%, 15%, 10%] `linker`(role) `noun`[price, timeline, scope].
- `tpl-biz-neg-02`: *"If you can {chunk:linker}, we can {chunk:closer}."* — EN mẫu: *"If you can meet us halfway, we can come to an agreement."* — VI: *"Nếu bạn nhân nhượng nửa chừng, chúng ta có thể đi đến thỏa thuận."* — slots: `linker`(role) `closer`(role).

**Daily — small-talk (B2)**
- `tpl-day-st-01`: *"{chunk:opener} — {chunk:linker}, {subject} {verb}."* — EN mẫu: *"It's been a while — speaking of which, we should catch up."* — VI: *"Đã một thời gian rồi — nhân tiện nói đến, chúng ta nên hàn huyên."* — slots: `opener`(role) `linker`(role) `subject`[we, you and I] `verb`[catch up, meet up, have coffee].
- `tpl-day-st-02`: *"{chunk:opener}, {chunk:closer}."* — EN mẫu: *"To keep things short, let's pick this up later."* — VI: *"Để giữ cho ngắn gọn, để dành nói tiếp sau."* — slots: `opener`(role) `closer`(role).

**Daily — opinion (B2)**
- `tpl-day-op-01`: *"{chunk:opener}, {subject} {verb} {noun}."* — EN mẫu: *"From my point of view, we should weigh the pros and cons."* — VI: *"Theo quan điểm của tôi, chúng ta nên cân nhắc ưu nhược điểm."* — slots: `opener`(role) `subject`[we, you, they] `verb`[should weigh, need to consider, must discuss] `noun`[the pros and cons, the options, the risks].
- `tpl-day-op-02`: *"{chunk:opener} — {chunk:closer}."* — EN mẫu: *"To be honest, I couldn't agree more."* — VI: *"Thành thật mà nói, tôi hoàn toàn đồng ý."* — slots: `opener`(role) `closer`(role).

**Daily — daily-work (B2)**
- `tpl-day-work-01`: *"{chunk:opener}, {subject} need to {chunk:linker} {noun} to {chunk:closer}."* — EN mẫu: *"To stay on top of things, we need to prioritize the tasks to get them done by Friday."* — VI: *"Để luôn theo sát công việc, chúng ta cần ưu tiên các việc để hoàn thành trước thứ Sáu."* — slots: `opener`(role) `subject`[we, I, the team] `linker`(role) `noun`[the tasks, the deadlines] `closer`(role).
- `tpl-day-work-02`: *"Let's {chunk:linker} and {chunk:closer}."* — EN mẫu: *"Let's push things forward and wrap things up."* — VI: *"Hãy thúc đẩy công việc và chốt lại mọi việc."* — slots: `linker`(role) `closer`(role).

> Tổng kết seed v1: **64 chunks** (IT 23, Business 21, Daily 20) + **18 templates** (2/context × 9 contexts).

---

## 9. Open Questions

- Vị trí file Firestore rules trong repo (sẽ rà khi triển khai)
- Chuẩn IPA dùng cho seed (British IPA như trên — xác nhận khi triển khai seed)
- `examples` của chunk sẽ sinh từ template mẫu cùng context — cần user chốt format hiển thị
