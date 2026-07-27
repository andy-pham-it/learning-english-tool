# Dictionary Sub-App Design

> Sub-app dictionary cho The Hub ecosystem — tra từ Anh-Việt qua AI trong sandboxed iframe.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────┐
│                 The Hub (InlayForgeKit)            │
│  ┌──────────────────────────────────────────────┐ │
│  │  Portal: /portal/dictionary                  │ │
│  │  ┌──────────────────────────────────────────┐│ │
│  │  │  <iframe sandbox="allow-scripts ...">    ││ │
│  │  │  ┌─────────────────────────────────────┐  ││ │
│  │  │  │  Dictionary Sub-App                 │  ││ │
│  │  │  │  (Angular standalone)               │  ││ │
│  │  │  │                                     │  ││ │
│  │  │  │  createHubClient() ◄──► hub-client  │  ││ │
│  │  │  │    - client.auth.getUser()          │  ││ │
│  │  │  │    - client.ai.chat()               │  ││ │
│  │  │  │    - client.storage.get/set         │  ││ │
│  │  │  └─────────────────────────────────────┘  ││ │
│  │  └──────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Key Decisions

- **Sub-app chạy trong same project (learning-english-tool)**, deploy qua Vercel
- **Không cần Vercel function riêng** — dùng `client.ai.chat()` của hub-client SDK, route AI call qua The Hub's AI gateway
- **Không dùng Firebase** — auth qua `client.auth`, storage qua `client.storage`
- **Không dùng MainLayout / auth guard** — standalone component, auth check via hub-client
- **Không dùng Angular Router** — single-page trong iframe

### Permissions cần đăng ký trong SubAppManifest

```typescript
{
  id: 'dictionary',
  name: 'Dictionary',
  description: 'Tra từ Anh-Việt với AI',
  icon: 'book-outline',
  url: 'https://learning-english-tools.vercel.app/sub-app/dictionary',
  permissions: ['auth', 'ai:*', 'storage'],
  version: '1.0.0',
}
```

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Angular 18 (standalone components) |
| Styling | Tailwind CSS (same as learning-english-tool) |
| Hub SDK | `@the-hub/hub-client` |
| AI | `client.ai.chat()` — Gemini 2.0 Flash |
| Storage | `client.storage` — key-value (scoped) |
| Auth | `client.auth.getUser()` |
| Deployment | Vercel (learning-english-tool project) |

---

## 3. Component Tree

```
DictionarySubAppComponent
├── SearchBar
│   ├── Input (tìm kiếm)
│   └── Search button
├── WordResultCard (khi có kết quả)
│   ├── WordHeader
│   │   ├── Từ vựng + phiên âm IPA
│   │   └── Nút TTS (phát âm — dùng Web Speech API)
│   ├── DefinitionSections (cho mỗi partOfSpeech)
│   │   ├── Định nghĩa EN
│   │   ├── Định nghĩa VI
│   │   ├── Ví dụ EN + VI
│   │   └── Collocations
│   └── ActionBar
│       ├── Save to vocabulary (bookmark)
│       └── Copy word
├── HistorySidebar (desktop ≥768px)
│   ├── Search history
│   ├── Personal vocabulary list
│   └── Sort (A-Z, Newest, Category)
│   └── HistoryDrawer (mobile <768px, toggle by ☰)
└── EmptyState (khi chưa search)
```

---

## 4. Services

### 4.1 DictionaryAiService

Wraps `client.ai.chat()` với prompt dictionary + caching.

```typescript
interface DictionaryAiService {
  lookupWord(word: string): Promise<DictionaryResult>;
}

interface DictionaryResult {
  word: string;
  phonetic?: string;
  entries: DictionaryEntry[];
  collocations: Collocation[];
  error?: string;
}

interface DictionaryEntry {
  partOfSpeech: string;       // "noun", "verb", etc.
  definitions: Definition[];
}

interface Definition {
  en: string;                 // English definition
  vi: string;                 // Vietnamese translation
  example?: string;           // English example
  exampleVi?: string;         // Vietnamese translation
}

interface Collocation {
  phrase: string;
  meaning: string;
  exampleEn: string;
  exampleVi: string;
}
```

**AI Prompt**: System instruction yêu cầu Gemini trả về JSON strict (xem spec đầy đủ ở phần prompt).

**Caching**: `client.storage.set(`cache_${word}`, ...)` với TTL 30 ngày. Check cache trước khi gọi AI.

### 4.2 DictionaryStorageService

Wraps `client.storage` cho history và vocabulary.

```typescript
interface DictionaryStorageService {
  // History — recent searches
  getHistory(): Promise<string[]>;
  addToHistory(word: string): Promise<void>;
  clearHistory(): Promise<void>;
  
  // Vocabulary — saved words
  getVocabulary(): Promise<Record<string, VocabItem>>;
  saveWord(word: string, note?: string): Promise<void>;
  removeWord(word: string): Promise<void>;
  
  // Cache
  getCached(word: string): Promise<DictionaryResult | null>;
  setCache(word: string, data: DictionaryResult): Promise<void>;
}
```

**Storage keys**:
- `dictionary_history: string[]` — max 100 entries, newest first
- `dictionary_vocabulary: Record<string, { note, savedAt }>` 
- `dictionary_cache_{word}: { data, _cachedAt }` — TTL 30 ngày

---

## 5. AI Prompt

### System Instruction

```
You are a professional English-Vietnamese dictionary AI.
Given a word or phrase, return a strict JSON object with this exact structure:

{
  "word": "the requested word",
  "phonetic": "/ipa_pronunciation/",
  "entries": [
    {
      "partOfSpeech": "noun | verb | adjective | adverb | etc.",
      "definitions": [
        {
          "en": "English definition",
          "vi": "Vietnamese translation/definition",
          "example": "English example sentence",
          "exampleVi": "Vietnamese translation of example"
        }
      ]
    }
  ],
  "collocations": [
    {
      "phrase": "common phrase with this word",
      "meaning": "meaning of the phrase",
      "exampleEn": "example in English",
      "exampleVi": "example in Vietnamese"
    }
  ]
}

Rules:
1. Group multiple meanings by part of speech entries
2. 1-3 definitions per entry, most common first
3. 2-4 collocations if applicable
4. Phonetic in IPA format
5. Return ONLY the JSON object — no markdown, no other text
6. If the word doesn't exist, return { "error": "Word not found", "word": "..." }
```

### Generation Config

```typescript
{
  temperature: 0.2,
  maxTokens: 1024,
}
```

### Response Parsing

```typescript
function parseResponse(text: string): DictionaryResult {
  // Strip markdown code blocks if wrapped
  const cleaned = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  
  if (parsed.error) {
    return { word: parsed.word, entries: [], collocations: [], error: parsed.error };
  }
  
  return parsed;
}
```

---

## 6. UI Layout

### Desktop (≥768px) — 2 cột

```
┌────── Search Bar (full width) ──────────────────────┐
│  🔍 [   Type a word...    ] [🔊 Save]               │
├───────────┬──────────────────────────────────────────┤
│ Sidebar   │  Main Panel                              │
│ (280px)   │                                          │
│           │  aberration                               │
│ 📋 Lịch sử│  /ˌæb.əˈreɪ.ʃən/  🔊                    │
│ · aberr.. │  ───────────────────────────              │
│ · parad.. │  noun                                     │
│ · heuri.. │  EN: a deviation from what is normal      │
│           │  VI: sự sai lệch, sự lệch lạc            │
│ ⭐ Đã lưu │  "His behavior was an aberration"         │
│ · seren.. │  "Hành vi của anh ta là một sự lệch lạc"  │
│ · ephem.. │  ───────────────────────────              │
│           │  Collocations                             │
│ Sort:     │  · social aberration: sự lệch lạc xã hội  │
│ ○ A-Z     │                                          │
│ ○ Newest  │  ┌─── Bookmark ───┐                       │
│ ○ Cat     │  │ ⭐ Save word  │                       │
└───────────┴──────────────────────────────────────────┘
```

### Mobile (<768px) — 1 cột

- Search bar + result full-width
- Sidebar là drawer (toggle bằng ☰ hamburger)
- Bottom sheet cho actions

### Events từ Hub

```typescript
// Dark mode sync
client.events.on('theme-changed', ({ theme }) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
});
```

### TTS (Text-to-Speech)

Dùng Web Speech API (có sẵn trong browser) — giống learning-english-tool hiện tại:

```typescript
const utterance = new SpeechSynthesisUtterance(word);
utterance.lang = 'en-US';
speechSynthesis.speak(utterance);
```

---

## 7. Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| Word not found | Parse `{ error: "..." }` → show inline message |
| AI response unparseable | Try parse, fallback → show "Không thể xử lý kết quả" + retry button |
| Cache hit | Render immediately, no AI call |
| Cache expired (>30d) | Re-fetch from AI |
| Network/timeout | Show error message + retry button |
| Empty input | Disable search button |
| Special chars | Pass through — AI handles |
| Multi-word phrases | Same flow — AI handles naturally |
| Unauthenticated | Show "Vui lòng đăng nhập vào The Hub" message |

---

## 8. Files Changed

| File | Action |
|---|---|
| `web/src/app/sub-app/dictionary/dictionary-sub-app.component.ts` | CREATE |
| `web/src/app/sub-app/dictionary/dictionary-sub-app.component.html` | CREATE |
| `web/src/app/sub-app/dictionary/dictionary-sub-app.component.css` | CREATE |
| `web/src/app/sub-app/dictionary/dictionary-ai.service.ts` | CREATE |
| `web/src/app/sub-app/dictionary/dictionary-storage.service.ts` | CREATE |
| `web/src/app/app.routes.ts` | EDIT — thêm route `/sub-app/dictionary` |
| `package.json` | EDIT — thêm `@the-hub/hub-client` |

---

## 9. Implementation Order

1. Install `@the-hub/hub-client`
2. Create `DictionaryAiService` (AI call + cache + parsing)
3. Create `DictionaryStorageService` (history + vocabulary via hub-client storage)
4. Create `DictionarySubAppComponent` (standalone component, inject services)
5. Create templates (search bar → result card → sidebar → empty state)
6. Add route in `app.routes.ts`
7. Register in The Hub's `SubAppManifest`
8. Test: load in The Hub portal, verify search/auth/storage

---

## 10. Out of Scope

- Flashcard integration (đã có trong learning-english-tool chính, sub-app chỉ tra từ)
- Multiple languages (chỉ EN-VI)
- Offline mode
- Pronunciation audio download
- Word games / quizzes
