# Dictionary Sub-App Implementation Plan

> For agentic workers: Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build a standalone dictionary sub-app for The Hub ecosystem — EN-VI lookup via AI in a sandboxed iframe.

**Architecture:** Angular 18 standalone component inside iframe. Uses `@the-hub/hub-client` SDK (`client.ai.chat()` for AI lookups, `client.storage` for history/vocabulary cache, `client.auth.getUserInfo()` for auth). No Firebase, no Vercel API functions, no MainLayout.

**Tech Stack:** Angular 18 standalone, Tailwind CSS, `@the-hub/hub-client` (local package at `../the-hub-Application/packages/hub-client/`)

## Global Constraints

- All components standalone (no NgModules)
- Tailwind CSS for layout/styling
- hub-client SDK uses OpenAI-format messages: `{ role: 'system' | 'user' | 'assistant', content: string }`
- `client.ai.chat()` returns `{ id, content, model }` — content is string, not Gemini parts array
- `client.storage.get(key)` returns `{ value }` — access `.value`
- `client.auth.getUserInfo()` in hub-client SDK, NOT `getUser()`
- Auth not required for read-only usage — only for save-to-vocabulary
- Routes: `src/app/app.routes.ts` — add `/sub-app/dictionary`
- No MainLayout, no auth guard for sub-app route
- `@the-hub/hub-client` not on npm — use file: dependency pointing to `../the-hub-Application/packages/hub-client`

---

### Task 1: Install hub-client dependency & create directory

**Files:**
- Modify: `web/package.json`
- Create: `web/src/app/sub-app/dictionary/` directory
- Create: `web/src/app/sub-app/dictionary/models.ts`

- [ ] **Step 1: Create directory for sub-app**

```bash
mkdir -p web/src/app/sub-app/dictionary
```

- [ ] **Step 2: Add hub-client dependency to package.json**

Edit `web/package.json` to add before the closing `}`:

```json
  "dependencies": {
    ...existing deps...,
    "@the-hub/hub-client": "file:../../the-hub-Application/packages/hub-client"
  }
```

- [ ] **Step 3: Create models.ts with all interfaces**

Create `web/src/app/sub-app/dictionary/models.ts`:

```typescript
export interface DictionaryResult {
  word: string;
  phonetic?: string;
  entries: DictionaryEntry[];
  collocations: Collocation[];
  error?: string;
}

export interface DictionaryEntry {
  partOfSpeech: string;
  definitions: Definition[];
}

export interface Definition {
  en: string;
  vi: string;
  example?: string;
  exampleVi?: string;
}

export interface Collocation {
  phrase: string;
  meaning: string;
  exampleEn: string;
  exampleVi: string;
}

export interface VocabItem {
  note: string;
  savedAt: number;
}
```

- [ ] **Step 4: Build hub-client locally**

```bash
cd /Users/admin/personal/the-hub-Application/packages/hub-client && npm run build
```

- [ ] **Step 5: Verify package resolves**

```bash
cd /Users/admin/personal/learning-english-tool/web && npm ls @the-hub/hub-client
```

---

### Task 2: Create DictionaryAiService

**Files:**
- Create: `web/src/app/sub-app/dictionary/dictionary-ai.service.ts`

**Interfaces:**
- Consumes: `DictionaryResult` from `./models`, hub-client's `client.ai.chat()`
- Produces: `lookupWord(word) => Promise<DictionaryResult>`

- [ ] **Step 1: Create DictionaryAiService**

Create `web/src/app/sub-app/dictionary/dictionary-ai.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { DictionaryResult } from './models';
import type { HubClient } from '@the-hub/hub-client';

const SYSTEM_PROMPT = `You are a professional English-Vietnamese dictionary AI.
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
1. Group multiple meanings by part of speech entries.
2. 1-3 definitions per entry, most common first.
3. 2-4 collocations if applicable.
4. Phonetic in IPA format.
5. Return ONLY the JSON object — no markdown, no other text.
6. If the word doesn't exist, return { "error": "Word not found", "word": "the word" }`;

@Injectable({ providedIn: 'root' })
export class DictionaryAiService {
  private hubClient: HubClient | null = null;
  private cache = new Map<string, { data: DictionaryResult; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  setHubClient(client: HubClient): void {
    this.hubClient = client;
  }

  async lookupWord(word: string): Promise<DictionaryResult> {
    // Check in-memory cache first
    const cached = this.cache.get(word);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // Check hub-client storage cache
    if (this.hubClient) {
      const stored = await this.hubClient.storage.get(`dictionary_cache_${word}`);
      if (stored?.value) {
        const parsed = stored.value as { data: DictionaryResult; cachedAt: number };
        if (Date.now() - parsed.cachedAt < this.CACHE_TTL_MS) {
          this.cache.set(word, parsed);
          return parsed.data;
        }
      }
    }

    // Call AI
    const result = await this.callAi(word);

    // Cache result
    const cacheEntry = { data: result, cachedAt: Date.now() };
    this.cache.set(word, cacheEntry);
    if (this.hubClient) {
      await this.hubClient.storage.set(`dictionary_cache_${word}`, cacheEntry);
    }

    return result;
  }

  private async callAi(word: string): Promise<DictionaryResult> {
    if (!this.hubClient) {
      return { word, entries: [], collocations: [], error: 'Not connected to The Hub' };
    }

    try {
      const response = await this.hubClient.ai.chat({
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: word },
        ],
        temperature: 0.2,
        maxTokens: 1024,
      });

      const cleaned = response.content
        .replace(/```json?\s*/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (parsed.error) {
        return { word: parsed.word || word, entries: [], collocations: [], error: parsed.error };
      }

      return {
        word: parsed.word || word,
        phonetic: parsed.phonetic,
        entries: parsed.entries || [],
        collocations: parsed.collocations || [],
      };
    } catch (err) {
      return { word, entries: [], collocations: [], error: 'Failed to look up word. Please try again.' };
    }
  }
}
```

---

### Task 3: Create DictionaryStorageService

**Files:**
- Create: `web/src/app/sub-app/dictionary/dictionary-storage.service.ts`

**Interfaces:**
- Consumes: `VocabItem` from `./models`, hub-client's `client.storage`
- Produces: history + vocabulary CRUD methods

- [ ] **Step 1: Create DictionaryStorageService**

Create `web/src/app/sub-app/dictionary/dictionary-storage.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import type { HubClient } from '@the-hub/hub-client';
import { VocabItem } from './models';

const HISTORY_KEY = 'dictionary_history';
const VOCABULARY_KEY = 'dictionary_vocabulary';
const MAX_HISTORY = 100;

@Injectable({ providedIn: 'root' })
export class DictionaryStorageService {
  private hubClient: HubClient | null = null;

  setHubClient(client: HubClient): void {
    this.hubClient = client;
  }

  private requireClient(): HubClient {
    if (!this.hubClient) throw new Error('HubClient not set');
    return this.hubClient;
  }

  // --- History ---

  async getHistory(): Promise<string[]> {
    try {
      const res = await this.requireClient().storage.get(HISTORY_KEY);
      return (res?.value as string[]) || [];
    } catch {
      return [];
    }
  }

  async addToHistory(word: string): Promise<void> {
    const history = await this.getHistory();
    const filtered = history.filter(w => w.toLowerCase() !== word.toLowerCase());
    filtered.unshift(word);
    await this.requireClient().storage.set(HISTORY_KEY, filtered.slice(0, MAX_HISTORY));
  }

  async clearHistory(): Promise<void> {
    await this.requireClient().storage.set(HISTORY_KEY, []);
  }

  // --- Vocabulary ---

  async getVocabulary(): Promise<Record<string, VocabItem>> {
    try {
      const res = await this.requireClient().storage.get(VOCABULARY_KEY);
      return (res?.value as Record<string, VocabItem>) || {};
    } catch {
      return {};
    }
  }

  async saveWord(word: string, note = ''): Promise<void> {
    const vocab = await this.getVocabulary();
    vocab[word.toLowerCase()] = { note, savedAt: Date.now() };
    await this.requireClient().storage.set(VOCABULARY_KEY, vocab);
  }

  async removeWord(word: string): Promise<void> {
    const vocab = await this.getVocabulary();
    delete vocab[word.toLowerCase()];
    await this.requireClient().storage.set(VOCABULARY_KEY, vocab);
  }
}
```

---

### Task 4: Create DictionarySubAppComponent (standalone component)

**Files:**
- Create: `web/src/app/sub-app/dictionary/dictionary-sub-app.component.ts`
- Create: `web/src/app/sub-app/dictionary/dictionary-sub-app.component.html`
- Create: `web/src/app/sub-app/dictionary/dictionary-sub-app.component.css`

- [ ] **Step 1: Create component TS**

Create `web/src/app/sub-app/dictionary/dictionary-sub-app.component.ts`:

```typescript
import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryAiService } from './dictionary-ai.service';
import { DictionaryStorageService } from './dictionary-storage.service';
import { DictionaryResult, VocabItem } from './models';

@Component({
  selector: 'app-dictionary-sub-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dictionary-sub-app.component.html',
  styleUrls: ['./dictionary-sub-app.component.css'],
})
export class DictionarySubAppComponent implements OnInit, OnDestroy {
  private aiService = new DictionaryAiService();
  private storageService = new DictionaryStorageService();
  private themeUnsubscribe?: () => void;
  private hubClient: any = null;

  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  history = signal<string[]>([]);
  vocabulary = signal<Record<string, VocabItem>>({});
  isSidebarOpen = signal(false);
  sortBy = signal<'alpha' | 'time'>('time');

  sortedHistory = computed(() => {
    const list = [...this.history()];
    if (this.sortBy() === 'alpha') {
      return list.sort((a, b) => a.localeCompare(b));
    }
    return list; // newest first (already in order)
  });

  vocabWords = computed(() => Object.keys(this.vocabulary()));

  isSaved = computed(() => {
    const currentWord = this.result()?.word?.toLowerCase();
    return currentWord ? currentWord in this.vocabulary() : false;
  });

  async ngOnInit() {
    await this.initHubClient();
  }

  ngOnDestroy() {
    this.themeUnsubscribe?.();
  }

  private async initHubClient() {
    try {
      const { createHubClient } = await import('@the-hub/hub-client');
      this.hubClient = createHubClient({ debug: true });
      await this.hubClient.ready();

      this.aiService.setHubClient(this.hubClient);
      this.storageService.setHubClient(this.hubClient);

      // Theme sync
      this.themeUnsubscribe = this.hubClient.events.on('theme-changed', ({ theme }: any) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      });

      // Load history and vocabulary
      this.history.set(await this.storageService.getHistory());
      this.vocabulary.set(await this.storageService.getVocabulary());

      // Auth check
      try {
        await this.hubClient.auth.getUserInfo();
      } catch {
        this.error.set('Please log in to The Hub to use the dictionary.');
      }
    } catch {
      this.error.set('Failed to connect to The Hub.');
    }
  }

  async search() {
    if (!this.searchQuery.trim()) return;
    this.loading.set(true);
    this.error.set(null);

    const result = await this.aiService.lookupWord(this.searchQuery.trim());

    if (result.error) {
      this.error.set(result.error);
      this.result.set(null);
    } else {
      this.result.set(result);
      await this.storageService.addToHistory(this.searchQuery.trim());
      this.history.set(await this.storageService.getHistory());
    }

    this.loading.set(false);
  }

  selectWord(word: string) {
    this.searchQuery = word;
    this.search();
    this.isSidebarOpen.set(false);
  }

  async saveWord() {
    const word = this.result()?.word;
    if (!word) return;
    await this.storageService.saveWord(word);
    this.vocabulary.set(await this.storageService.getVocabulary());
  }

  async removeWord(word: string) {
    await this.storageService.removeWord(word);
    this.vocabulary.set(await this.storageService.getVocabulary());
  }

  speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }
}
```

- [ ] **Step 2: Create component HTML template**

Create `web/src/app/sub-app/dictionary/dictionary-sub-app.component.html`:

```html
<div class="flex h-screen bg-slate-50 overflow-hidden">
  <!-- Mobile overlay -->
  <div 
    *ngIf="isSidebarOpen()" 
    class="fixed inset-0 bg-black/30 z-30 lg:hidden"
    (click)="toggleSidebar()"
  ></div>

  <!-- Sidebar -->
  <aside 
    [class.-translate-x-full]="!isSidebarOpen()"
    [class.translate-x-0]="isSidebarOpen()"
    class="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-40 fixed lg:static inset-y-0 left-0 transition-transform duration-300 lg:translate-x-0"
  >
    <!-- Sidebar Header -->
    <div class="p-4 border-b border-slate-100 space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-black text-slate-900 flex items-center gap-2">
          <span class="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-sm">D</span>
          Dictionary
        </h1>
        <button (click)="toggleSidebar()" class="lg:hidden p-1 hover:bg-slate-100 rounded-lg text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="relative group">
        <input 
          type="text" 
          [(ngModel)]="searchQuery"
          (keyup.enter)="search()"
          placeholder="Search word..."
          class="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
        />
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-slate-100">
      <button class="flex-1 py-3 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600">History</button>
      <button class="flex-1 py-3 text-xs font-bold text-slate-400">Saved</button>
    </div>

    <!-- Sort -->
    <div class="flex gap-1 px-4 py-3 border-b border-slate-50">
      <button (click)="sortBy.set('time')" [class]="sortBy() === 'time' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'" class="text-[9px] px-2 py-1 rounded-full font-bold transition-all">Newest</button>
      <button (click)="sortBy.set('alpha')" [class]="sortBy() === 'alpha' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'" class="text-[9px] px-2 py-1 rounded-full font-bold transition-all">A-Z</button>
    </div>

    <!-- Word List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-1">
      <div *ngIf="sortedHistory().length === 0" class="text-center py-8 text-slate-400 text-xs">
        No search history yet
      </div>
      <button 
        *ngFor="let word of sortedHistory()" 
        (click)="selectWord(word)"
        [class.bg-indigo-50]="result()?.word?.toLowerCase() === word.toLowerCase()"
        class="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-all group"
      >
        <span class="font-bold text-sm text-slate-900 capitalize">{{ word }}</span>
      </button>
    </div>
  </aside>

  <!-- Main Panel -->
  <main class="flex-1 overflow-y-auto relative bg-white lg:rounded-tl-[3rem] lg:shadow-2xl lg:shadow-slate-200/50 lg:-ml-12 z-50">
    <!-- Mobile header -->
    <div class="lg:hidden flex items-center gap-3 p-4 border-b border-slate-100">
      <button (click)="toggleSidebar()" class="p-2 hover:bg-slate-100 rounded-xl text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <div class="relative flex-1">
        <input 
          type="text" 
          [(ngModel)]="searchQuery"
          (keyup.enter)="search()"
          placeholder="Search word..."
          class="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
        />
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div *ngIf="loading()" class="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
      <div class="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
      <p class="text-slate-400 font-medium">Consulting AI...</p>
    </div>

    <div class="max-w-3xl mx-auto p-6 lg:p-12 min-h-full flex flex-col">
      <!-- Empty State -->
      <div *ngIf="!result() && !error()" class="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-30">
        <div class="text-8xl mb-8">📖</div>
        <h3 class="text-2xl font-black text-slate-900 mb-3">Dictionary</h3>
        <p class="text-slate-500 max-w-sm">Search for any English word to see definitions, examples, and translations.</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error()" class="bg-rose-50 border border-rose-100 rounded-3xl p-8 text-center">
        <div class="text-4xl mb-4">😕</div>
        <p class="text-rose-600 font-bold">{{ error() }}</p>
        <button (click)="search()" class="mt-4 text-indigo-600 text-sm font-bold underline">Try again</button>
      </div>

      <!-- Result -->
      <div *ngIf="result() && !loading()" class="space-y-8">
        <!-- Word Header -->
        <div class="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
          <div class="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500 rounded-full opacity-20 blur-3xl"></div>
          <div class="relative z-10">
            <div class="flex justify-between items-start">
              <div class="space-y-2">
                <h2 class="text-4xl font-black capitalize tracking-tight">{{ result()?.word }}</h2>
                <div class="flex items-center gap-3">
                  <span class="text-indigo-100 font-mono text-base">{{ result()?.phonetic }}</span>
                  <button (click)="speak(result()?.word || '')" class="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                  </button>
                </div>
              </div>
              <button 
                (click)="isSaved() ? removeWord(result()!.word!) : saveWord()"
                [class.bg-white]="!isSaved()"
                [class.bg-indigo-800]="isSaved()"
                class="p-4 rounded-2xl transition-all active:scale-95"
              >
                <svg *ngIf="!isSaved()" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <svg *ngIf="isSaved()" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Definitions -->
        <div *ngFor="let entry of result()?.entries" class="space-y-6">
          <div class="flex items-center gap-4 px-2">
            <span class="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full tracking-[0.2em]">{{ entry.partOfSpeech }}</span>
            <div class="h-[1px] flex-1 bg-slate-100"></div>
          </div>

          <div *ngFor="let def of entry.definitions" class="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <p class="text-slate-900 font-bold text-lg mb-3">{{ def.en }}</p>
            <span class="inline-block px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl mb-4 text-sm">{{ def.vi }}</span>
            <div *ngIf="def.example" class="bg-slate-50 rounded-2xl p-4 mt-4 border border-slate-100">
              <p class="italic text-slate-600 text-sm">"{{ def.example }}"</p>
              <p class="text-slate-400 text-xs mt-2 pt-2 border-t border-slate-200">— {{ def.exampleVi }}</p>
            </div>
          </div>
        </div>

        <!-- Collocations -->
        <div *ngIf="result()?.collocations?.length" class="pt-6">
          <div class="flex items-center gap-4 px-2 mb-6">
            <span class="px-4 py-1.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-[0.2em]">Collocations</span>
            <div class="h-[1px] flex-1 bg-indigo-50"></div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div *ngFor="let col of result()?.collocations" class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <h4 class="text-base font-black text-slate-900 mb-2">{{ col.phrase }}</h4>
              <p class="text-indigo-500 text-xs font-bold mb-3 uppercase tracking-wider">{{ col.meaning }}</p>
              <div class="bg-slate-50 rounded-xl p-3">
                <p class="text-slate-600 text-xs italic">"{{ col.exampleEn }}"</p>
                <p class="text-slate-400 text-[10px] mt-1">— {{ col.exampleVi }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
```

- [ ] **Step 3: Create component CSS**

Create `web/src/app/sub-app/dictionary/dictionary-sub-app.component.css`:

```css
:host { display: block; height: 100vh; }
.animate-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
```

---

### Task 5: Add route in app.routes.ts

**Files:**
- Modify: `web/src/app/app.routes.ts`

- [ ] **Step 1: Edit app.routes.ts**

Add route for `/sub-app/dictionary` at the top level (outside MainLayout, no auth guard):

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './core/layout/main-layout/main-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  
  // Sub-app routes (no MainLayout, no auth guard)
  { 
    path: 'sub-app/dictionary', 
    loadComponent: () => import('./sub-app/dictionary/dictionary-sub-app.component').then(m => m.DictionarySubAppComponent) 
  },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'flashcards', loadComponent: () => import('./features/flashcards/pages/flashcards-page.component').then(m => m.FlashcardsPageComponent) },
      { path: 'think-aloud', loadComponent: () => import('./features/think-aloud/pages/think-aloud-page.component').then(m => m.ThinkAloudPageComponent) },
      { path: 'minigames', loadChildren: () => import('./features/minigames/minigames.routes').then(m => m.MINIGAME_ROUTES) },
      { path: 'bossfight', loadChildren: () => import('./features/bossfight/bossfight.routes').then(m => m.BOSSFIGHT_ROUTES) },
      { path: 'dictionary', loadComponent: () => import('./features/dictionary/dictionary.component').then(m => m.DictionaryComponent) },
    ]
  }
];
```

---

### Task 6: Build and verify

- [ ] **Step 1: Run npm install**

```bash
cd /Users/admin/personal/learning-english-tool/web && npm install
```

- [ ] **Step 2: Build project**

```bash
cd /Users/admin/personal/learning-english-tool/web && npm run build
```

Expected: Build succeeds with no errors. If there are type errors in hub-client package, 
they may be pre-existing — check if they're from our code or from the dependency.

- [ ] **Step 3: Register SubAppManifest in The Hub**

In the Hub's `SubAppManifest`, add:

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
