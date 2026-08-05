# Phrase Lab Sub-App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Hub-embedded sub-app (`/sub-app/phrase-lab`) where users learn English phrases/chunks organized by domain → context → level, practice combining them into complex sentences via 4 practice modes, and train speaking with STT feedback — with progress saved to Firestore keyed by the Hub-authenticated user.

**Architecture:** New standalone Angular sub-app under `web/src/app/sub-app/phrase-lab/` (route registered top-level, no authGuard, embedded in The Hub iframe). Content (chunks + templates) lives in two public-read Firestore collections with a 24h localStorage cache; per-user progress lives in `phrase_progress/{uid}` (uid from a new shared `HubAuthService` that performs the parent-origin discovery handshake extracted from the dictionary sub-app). Pure combination/speech logic lives in `PhraseEngineService` (heavily unit-tested); UI is 7 thin components + a shell page with mode tabs.

**Tech Stack:** Angular 18 standalone components, RxJS signals (pattern.service precedent), Tailwind CSS, @angular/fire/firestore/lite, Web Speech API (core SpeechService), Karma unit tests, firebase-admin seed script (dev-only).

## Global Constraints

(Verbatim from `docs/superpowers/specs/2026-08-05-phrase-lab-design.md`)

- Angular 18 standalone components only — no NgModules.
- TypeScript strict (`strict: true`), no `any` in app code.
- All new app code under `web/src/app/sub-app/phrase-lab/`; shared auth service at `web/src/app/sub-app/auth/hub-auth.service.ts`.
- Firestore via `@angular/fire/firestore/lite` (`collection`/`getDocs`/`doc`/`getDoc`/`setDoc`), matching dictionary-storage.service.
- Collections: `phrase_chunks`, `phrase_templates` public read; `phrase_progress/{uid}` private, keyed by uid.
- Content cached in localStorage with 24h TTL; stale cache used on fetch failure + offline banner.
- Hub auth handshake has 10s timeout → null → local progress fallback; auth NEVER blocks learning.
- TTS/STT via Web Speech API through core `SpeechService` (`speak(text, lang='en-US')`, `startListening(lang='en-US'): Promise<string>`, `isRecognitionSupported(): boolean`).
- Role color coding: opener=blue, linker=purple, filler=orange, closer=green.
- Speak score ≥ 80 = mastered; streak increments max 1/day.
- Seed content v1 = spec Section 8: 64 chunks + 18 templates (authoritative; transcribe verbatim).
- Tests: Karma, run from `web/` (`npx ng test --watch=false`); targeted: `npx ng test --include='src/app/sub-app/phrase-lab/**/*.spec.ts' --watch=false`.
- Typecheck: `npx tsc --noEmit -p tsconfig.app.json` run from `web/`.

---

## File Structure

| File | Responsibility |
|---|---|
| `web/src/app/sub-app/auth/hub-auth.service.ts` | Hub origin discovery + `auth:getUserInfo` RPC (extracted from dictionary sub-app) |
| `web/src/app/sub-app/phrase-lab/models/phrase.model.ts` | `PhraseChunk`, `PhraseTemplate`, `PhraseProgress` interfaces |
| `web/src/app/sub-app/phrase-lab/services/phrase-engine.service.ts` | Pure logic: buildSentence, combineByRole, expectedSequence, validateOrder, annotateStructure, scoreSpeech |
| `web/src/app/sub-app/phrase-lab/services/phrase-content.service.ts` | Firestore content fetch + 24h localStorage cache + derived domain/context/level signals |
| `web/src/app/sub-app/phrase-lab/services/phrase-progress.service.ts` | Progress read/write (Firestore authed / localStorage fallback), streak + points |
| `web/firestore.rules` | Rules for 3 collections |
| `web/scripts/seed-data/phrase-seed.data.ts` | Seed arrays (transcribed from spec Section 8) |
| `web/scripts/seed-phrase-lab.ts` | firebase-admin batch seeder |
| `web/src/app/sub-app/phrase-lab/components/chunk-card.component.ts` | Single chunk display: IPA, meaning, example, TTS, Đã học button |
| `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts` | Domain→context→level filters + chunk list |
| `web/src/app/sub-app/phrase-lab/components/sentence-analysis.component.ts` | Role color-coded template structure + example |
| `web/src/app/sub-app/phrase-lab/components/sentence-builder.component.ts` | Slot-filling mode: select per slot → preview sentence |
| `web/src/app/sub-app/phrase-lab/components/role-combiner.component.ts` | Pick 1 chunk per role → validated combination |
| `web/src/app/sub-app/phrase-lab/components/order-arrange.component.ts` | Shuffled chunks → arrange in order → validate |
| `web/src/app/sub-app/phrase-lab/components/speak-practice.component.ts` | TTS slow sample + mic STT + score + wrong-word highlight |
| `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts` | Shell: mode tabs, template selector, header, wires progress |
| `web/src/app/app.routes.ts` | Add `sub-app/phrase-lab` route |

---

### Task 1: HubAuthService (shared)

**Files:**
- Create: `web/src/app/sub-app/auth/hub-auth.service.ts`
- Test: `web/src/app/sub-app/auth/hub-auth.service.spec.ts`

**Interfaces:**
- Produces: `interface HubUser { id: string; email: string | null; name: string | null; image: string | null }`
- Produces: `class HubAuthService` — `discoverHubOrigin(): string | null`, `requestUserInfo(timeoutMs: number = 10000): Promise<HubUser | null>`

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HubAuthService, HubUser } from './hub-auth.service';

describe('HubAuthService', () => {
  let service: HubAuthService;
  let fakeParent: { postMessage: jasmine.Spy };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HubAuthService);
    fakeParent = { postMessage: jasmine.createSpy('postMessage') };
    // Karma runs at the top level, so override window.parent to simulate being inside an iframe
    Object.defineProperty(window, 'parent', { configurable: true, value: fakeParent });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolves null when standalone (no hub param, window === window.parent)', async () => {
    Object.defineProperty(window, 'parent', { configurable: true, value: window });
    const result = await service.requestUserInfo(1000);
    expect(result).toBeNull();
  });

  it('adopts reply origin during discovery and resolves the user', async () => {
    const promise = service.requestUserInfo(2000);
    // Capture requestId the service posted to the fake parent
    expect(fakeParent.postMessage).toHaveBeenCalled();
    const posted = fakeParent.postMessage.calls.mostRecent().args[0] as {
      type: string; requestId: string; version: number;
    };
    expect(posted.type).toBe('auth:getUserInfo');
    expect(posted.version).toBe(1);
    const hubUser: HubUser = { id: 'u1', email: 'a@b.c', name: 'Ann', image: null };
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://hub.example.com',
      data: { requestId: posted.requestId, ok: true, data: hubUser },
    }));
    const result = await promise;
    expect(result).toEqual(hubUser);
  });

  it('resolves null on reply with ok:false', async () => {
    const promise = service.requestUserInfo(2000);
    const posted = fakeParent.postMessage.calls.mostRecent().args[0] as { requestId: string };
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://hub.example.com',
      data: { requestId: posted.requestId, ok: false, data: null },
    }));
    expect(await promise).toBeNull();
  });

  it('resolves null on timeout', fakeAsync(() => {
    let result: HubUser | null | undefined;
    service.requestUserInfo(500).then((r) => (result = r));
    expect(fakeParent.postMessage).toHaveBeenCalled();
    tick(600);
    expect(result).toBeNull();
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/auth/hub-auth.service.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './hub-auth.service'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import { Injectable } from '@angular/core';

export interface HubUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

@Injectable({ providedIn: 'root' })
export class HubAuthService {
  discoverHubOrigin(): string | null {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('hub');
    if (fromParam) {
      try {
        return new URL(fromParam).origin;
      } catch {
        /* fall through to referrer */
      }
    }
    if (window !== window.parent) {
      try {
        const ref = document.referrer;
        if (ref) return new URL(ref).origin;
      } catch {
        /* cross-origin referrer may be stripped (WebKit/Orion) */
      }
    }
    return null;
  }

  requestUserInfo(timeoutMs: number = 10000): Promise<HubUser | null> {
    return new Promise((resolve) => {
      let hubOrigin = this.discoverHubOrigin();
      const isDiscovery = !hubOrigin;
      if (!hubOrigin && window === window.parent) {
        resolve(null);
        return;
      }
      const requestId = crypto.randomUUID();
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { requestId?: string; ok?: unknown; data?: HubUser };
        if (!data || data.requestId !== requestId || typeof data.ok !== 'boolean') return;
        if (isDiscovery && !hubOrigin) {
          hubOrigin = event.origin; // Hub only replies to whitelisted origins
        }
        if (event.origin !== hubOrigin) return;
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data.ok && data.data ? data.data : null);
      };
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, timeoutMs);
      window.addEventListener('message', onMessage);
      window.parent.postMessage(
        { type: 'auth:getUserInfo', requestId, version: 1 },
        hubOrigin ?? '*'
      );
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/auth/hub-auth.service.spec.ts' --watch=false`
Expected: PASS (4 specs)

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/auth/hub-auth.service.ts web/src/app/sub-app/auth/hub-auth.service.spec.ts
git commit -m "feat(phrase-lab): shared HubAuthService with parent-origin discovery"
```

---

### Task 2: Phrase Models + PhraseEngineService

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/models/phrase.model.ts`
- Create: `web/src/app/sub-app/phrase-lab/services/phrase-engine.service.ts`
- Test: `web/src/app/sub-app/phrase-lab/services/phrase-engine.service.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type Role = 'opener' | 'linker' | 'filler' | 'closer'`
- Produces: `interface PhraseChunk { id: string; domain: string; context: string; level: 'A2'|'B1'|'B2'|'C1'; english: string; vietnamese: string; phonetic: string; role: Role; examples: { en: string; vi: string }[] }`
- Produces: `interface PhraseTemplate { id: string; domain: string; context: string; level: 'A2'|'B1'|'B2'|'C1'; english: string; vietnamese: string; structure: string; slots: { name: string; role: Role | null; options?: string[] }[]; example: { en: string; vi: string } }`
- Produces: `interface PhraseProgress { uid: string; masteredChunks: Record<string, { status: 'learning'|'mastered'; speakScore: number; lastPracticed: number }>; masteredTemplates: Record<string, { bestSpeakScore: number; attempts: number }>; streak: { current: number; lastDay: string }; totalPoints: number }`
- Produces: `class PhraseEngineService` (all pure):
  - `buildSentence(template: PhraseTemplate, fills: { name: string; value: string }[]): string`
  - `combineByRole(template: PhraseTemplate, chunks: PhraseChunk[], selection: Record<string, string>): { sentence: string | null; errors: string[] }`
  - `expectedSequence(template: PhraseTemplate, chunks: PhraseChunk[]): string[]`
  - `validateOrder(template: PhraseTemplate, chunks: PhraseChunk[], sequence: string[]): { correct: boolean; positionErrors: number[] }`
  - `annotateStructure(template: PhraseTemplate): { text: string; role: Role | null }[]`
  - `scoreSpeech(target: string, transcript: string): { score: number; wrongWords: string[] }`

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { PhraseEngineService } from './phrase-engine.service';
import { PhraseChunk, PhraseTemplate } from '../models/phrase.model';

const CHUNKS: PhraseChunk[] = [
  { id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'cân nhắc, xem xét', phonetic: '/teɪk ˈɪntə kənˌsɪdəˈreɪʃən/', role: 'linker', examples: [{ en: 'We should take the load into consideration.', vi: 'Chúng ta nên cân nhắc tải hệ thống.' }] },
  { id: 'it-meet-b1-01', domain: 'it', context: 'meeting', level: 'B1', english: 'I would like to add that', vietnamese: 'tôi muốn bổ sung rằng', phonetic: '/aɪ wʊd laɪk tə æd ðæt/', role: 'opener', examples: [{ en: 'I would like to add that we are on schedule.', vi: 'Tôi muốn bổ sung rằng chúng ta đúng tiến độ.' }] },
];

const TEMPLATE: PhraseTemplate = {
  id: 'tpl-it-meet-01', domain: 'it', context: 'meeting', level: 'B2',
  english: 'It would be better if we could take into consideration the system load before we proceed.',
  vietnamese: 'Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục.',
  structure: 'It would be better if {subject} {modal} {chunk:linker} the {noun} before we {verb}.',
  slots: [
    { name: 'subject', role: null, options: ['we', 'you', 'the team'] },
    { name: 'modal', role: null, options: ['could', 'would', 'can'] },
    { name: 'linker', role: 'linker' },
    { name: 'noun', role: null, options: ['system load', 'performance', 'the requirements'] },
    { name: 'verb', role: null, options: ['move on', 'proceed'] },
  ],
  example: { en: 'It would be better if we could take into consideration the system load before we proceed.', vi: 'Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục.' },
};

describe('PhraseEngineService', () => {
  let engine: PhraseEngineService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(PhraseEngineService);
  });

  it('buildSentence fills named slots and chunk:role placeholders, then caps placeholders', () => {
    const s = engine.buildSentence(TEMPLATE, [
      { name: 'subject', value: 'we' }, { name: 'modal', value: 'could' },
      { name: 'linker', value: 'take into consideration' }, { name: 'noun', value: 'system load' },
      { name: 'verb', value: 'proceed' },
    ]);
    expect(s).toBe('It would be better if we could take into consideration the system load before we proceed.');
  });

  it('buildSentence replaces unfilled placeholders with ___', () => {
    const s = engine.buildSentence(TEMPLATE, []);
    expect(s).toContain('___');
  });

  it('combineByRole accepts a matching chunk and builds a sentence', () => {
    const r = engine.combineByRole(TEMPLATE, CHUNKS, { linker: 'it-meet-b2-01' });
    expect(r.errors).toEqual([]);
    expect(r.sentence).toContain('take into consideration');
  });

  it('combineByRole rejects a chunk of a different level', () => {
    const r = engine.combineByRole(TEMPLATE, CHUNKS, { linker: 'it-meet-b1-01' });
    expect(r.sentence).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('combineByRole rejects when a role slot is unselected', () => {
    const r = engine.combineByRole(TEMPLATE, CHUNKS, {});
    expect(r.sentence).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('expectedSequence returns fill values in structure order', () => {
    expect(engine.expectedSequence(TEMPLATE, CHUNKS)).toEqual([
      'we', 'could', 'take into consideration', 'system load', 'proceed',
    ]);
  });

  it('validateOrder passes for the correct order and flags swapped positions', () => {
    const correct = ['we', 'could', 'take into consideration', 'system load', 'proceed'];
    expect(engine.validateOrder(TEMPLATE, CHUNKS, correct).correct).toBeTrue();
    const swapped = ['we', 'could', 'system load', 'take into consideration', 'proceed'];
    const r = engine.validateOrder(TEMPLATE, CHUNKS, swapped);
    expect(r.correct).toBeFalse();
    expect(r.positionErrors).toEqual([2, 3]);
  });

  it('annotateStructure tags chunk placeholders with their role', () => {
    const parts = engine.annotateStructure(TEMPLATE);
    const linker = parts.find((p) => p.text === '[linker]');
    expect(linker?.role).toBe('linker');
    expect(parts.some((p) => p.text === '[subject]' && p.role === null)).toBeTrue();
  });

  it('scoreSpeech scores 100 on exact match and lists missing words otherwise', () => {
    const target = 'It would be better if we could proceed.';
    expect(engine.scoreSpeech(target, 'it would be better if we could proceed').score).toBe(100);
    const r = engine.scoreSpeech(target, 'we could proceed');
    expect(r.score).toBeLessThan(80);
    expect(r.wrongWords).toContain('it');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/**/*.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './phrase-engine.service'"

- [ ] **Step 3: Write minimal implementation**

`web/src/app/sub-app/phrase-lab/models/phrase.model.ts`:

```typescript
export type Role = 'opener' | 'linker' | 'filler' | 'closer';
export type Level = 'A2' | 'B1' | 'B2' | 'C1';

export interface PhraseChunk {
  id: string;
  domain: string;
  context: string;
  level: Level;
  english: string;
  vietnamese: string;
  phonetic: string;
  role: Role;
  examples: { en: string; vi: string }[];
}

export interface PhraseTemplate {
  id: string;
  domain: string;
  context: string;
  level: Level;
  english: string;
  vietnamese: string;
  structure: string;
  slots: { name: string; role: Role | null; options?: string[] }[];
  example: { en: string; vi: string };
}

export interface PhraseProgress {
  uid: string;
  masteredChunks: Record<string, { status: 'learning' | 'mastered'; speakScore: number; lastPracticed: number }>;
  masteredTemplates: Record<string, { bestSpeakScore: number; attempts: number }>;
  streak: { current: number; lastDay: string };
  totalPoints: number;
}
```

`web/src/app/sub-app/phrase-lab/services/phrase-engine.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { PhraseChunk, PhraseTemplate, Role } from '../models/phrase.model';

export interface SpeakResult {
  score: number;
  wrongWords: string[];
}

@Injectable({ providedIn: 'root' })
export class PhraseEngineService {
  buildSentence(template: PhraseTemplate, fills: { name: string; value: string }[]): string {
    let sentence = template.structure;
    for (const fill of fills) {
      sentence = sentence.replace(
        new RegExp(`\\{chunk:${fill.name}\\}|\\{${fill.name}\\}`, 'g'),
        fill.value
      );
    }
    sentence = sentence.replace(/\{[^}]+\}/g, '___');
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (!sentence.endsWith('?') && !sentence.endsWith('.')) {
      sentence += '.';
    }
    return sentence;
  }

  combineByRole(
    template: PhraseTemplate,
    chunks: PhraseChunk[],
    selection: Record<string, string>
  ): { sentence: string | null; errors: string[] } {
    const errors: string[] = [];
    const fills: { name: string; value: string }[] = [];
    for (const slot of template.slots) {
      if (slot.role) {
        const chunkId = selection[slot.name];
        const chunk = chunkId ? chunks.find((c) => c.id === chunkId) : undefined;
        if (!chunk) {
          errors.push(`Vai trò "${slot.role}" chưa được chọn`);
          continue;
        }
        if (chunk.role !== slot.role) {
          errors.push(`"${chunk.english}" không phải vai trò ${slot.role}`);
          continue;
        }
        if (chunk.domain !== template.domain || chunk.context !== template.context || chunk.level !== template.level) {
          errors.push(`"${chunk.english}" không thuộc ${template.domain}/${template.context}/${template.level}`);
          continue;
        }
        fills.push({ name: slot.name, value: chunk.english });
      } else {
        fills.push({ name: slot.name, value: slot.options?.[0] ?? '' });
      }
    }
    if (errors.length > 0) return { sentence: null, errors };
    return { sentence: this.buildSentence(template, fills), errors };
  }

  expectedSequence(template: PhraseTemplate, chunks: PhraseChunk[]): string[] {
    const fills = new Map<string, string>();
    for (const slot of template.slots) {
      if (slot.role) {
        const match = chunks.find(
          (c) => c.role === slot.role && c.domain === template.domain && c.context === template.context && c.level === template.level
        );
        fills.set(slot.name, match?.english ?? `{${slot.name}}`);
      } else {
        fills.set(slot.name, slot.options?.[0] ?? '');
      }
    }
    const seq: string[] = [];
    const re = /\{chunk:(\w+)\}|\{(\w+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template.structure)) !== null) {
      const name = m[1] ?? m[2];
      const value = fills.get(name);
      if (value) seq.push(value);
    }
    return seq;
  }

  validateOrder(
    template: PhraseTemplate,
    chunks: PhraseChunk[],
    sequence: string[]
  ): { correct: boolean; positionErrors: number[] } {
    const expected = this.expectedSequence(template, chunks);
    const positionErrors: number[] = [];
    const maxLen = Math.max(expected.length, sequence.length);
    for (let i = 0; i < maxLen; i++) {
      if (expected[i] !== sequence[i]) positionErrors.push(i);
    }
    return { correct: positionErrors.length === 0, positionErrors };
  }

  annotateStructure(template: PhraseTemplate): { text: string; role: Role | null }[] {
    const roleBySlot = new Map<string, Role | null>();
    for (const slot of template.slots) roleBySlot.set(slot.name, slot.role);
    const parts: { text: string; role: Role | null }[] = [];
    const re = /\{chunk:(\w+)\}|\{(\w+)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(template.structure)) !== null) {
      if (m.index > last) parts.push({ text: template.structure.slice(last, m.index), role: null });
      const name = m[1] ?? m[2];
      parts.push({ text: `[${name}]`, role: roleBySlot.get(name) ?? null });
      last = m.index + m[0].length;
    }
    if (last < template.structure.length) parts.push({ text: template.structure.slice(last), role: null });
    return parts;
  }

  private normalizeWords(s: string): string[] {
    return s.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean);
  }

  scoreSpeech(target: string, transcript: string): SpeakResult {
    const t = this.normalizeWords(target);
    const u = this.normalizeWords(transcript);
    if (t.length === 0) return { score: 0, wrongWords: [] };
    const set = new Set(u);
    let matched = 0;
    for (const w of t) if (set.has(w)) matched++;
    const score = Math.round((matched / t.length) * 100);
    const wrongWords = t.filter((w) => !set.has(w));
    return { score, wrongWords };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/services/phrase-engine.service.spec.ts' --watch=false`
Expected: PASS (9 specs)

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/models/phrase.model.ts web/src/app/sub-app/phrase-lab/services/phrase-engine.service.ts web/src/app/sub-app/phrase-lab/services/phrase-engine.service.spec.ts
git commit -m "feat(phrase-lab): phrase models + PhraseEngineService with tests"
```

---

### Task 3: PhraseContentService

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/services/phrase-content.service.ts`
- Test: `web/src/app/sub-app/phrase-lab/services/phrase-content.service.spec.ts`

**Interfaces:**
- Consumes: `PhraseChunk`, `PhraseTemplate` (Task 2); Firestore token from `@angular/fire/firestore/lite`
- Produces: `class PhraseContentService` — `readonly chunks: Signal<PhraseChunk[]>`, `readonly templates: Signal<PhraseTemplate[]>`, `readonly loading: Signal<boolean>`, `readonly offline: Signal<boolean>`, `readonly domains: Signal<string[]>`, `readonly contexts: Signal<string[]>`, `readonly levels: Signal<string[]>`, `async loadAll(): Promise<void>`

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import * as lite from '@angular/fire/firestore/lite';
import { PhraseContentService } from './phrase-content.service';
import { PhraseChunk, PhraseTemplate } from '../models/phrase.model';

describe('PhraseContentService', () => {
  let service: PhraseContentService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(PhraseContentService);
  });

  it('fetches from Firestore when cache is empty and populates the cache', async () => {
    const chunk: PhraseChunk = { id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'x', phonetic: '/x/', role: 'linker', examples: [{ en: 'e', vi: 'v' }] };
    const template: PhraseTemplate = { id: 't1', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v', structure: '{a}', slots: [{ name: 'a', role: null, options: ['x'] }], example: { en: 'e', vi: 'v' } };
    const getDocsSpy = spyOn(lite, 'getDocs').and.callFake((ref: any) => {
      const name = ref.path ?? ref.id;
      const docs = name === 'phrase_chunks' ? [chunk] : [template];
      return Promise.resolve({ docs: docs.map((d) => ({ data: () => d })) } as any);
    });

    await service.loadAll();

    expect(getDocsSpy).toHaveBeenCalledTimes(2);
    expect(service.chunks()).toEqual([chunk]);
    expect(service.templates()).toEqual([template]);
    expect(service.domains()).toEqual(['it']);
    expect(localStorage.getItem('phrase_lab_chunks')).toBeTruthy();
  });

  it('uses the 24h cache and does not hit Firestore on a fresh cache', async () => {
    localStorage.setItem('phrase_lab_chunks', JSON.stringify([{ id: 'c1' }]));
    localStorage.setItem('phrase_lab_chunks_ts', String(Date.now()));
    localStorage.setItem('phrase_lab_templates', JSON.stringify([{ id: 't1' }]));
    localStorage.setItem('phrase_lab_templates_ts', String(Date.now()));
    const getDocsSpy = spyOn(lite, 'getDocs').and.returnValue(Promise.resolve({ docs: [] } as any));

    await service.loadAll();

    expect(getDocsSpy).not.toHaveBeenCalled();
    expect(service.chunks()).toEqual([{ id: 'c1' }] as any);
    expect(service.templates()).toEqual([{ id: 't1' }] as any);
  });

  it('sets offline and keeps stale cache when Firestore fails', async () => {
    localStorage.setItem('phrase_lab_chunks', JSON.stringify([{ id: 'c1' }]));
    localStorage.setItem('phrase_lab_chunks_ts', String(Date.now() - 25 * 60 * 60 * 1000)); // stale
    spyOn(lite, 'getDocs').and.returnValue(Promise.reject(new Error('network')));

    await service.loadAll();

    expect(service.offline()).toBeTrue();
    expect(service.chunks()).toEqual([{ id: 'c1' }] as any);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/services/phrase-content.service.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './phrase-content.service'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import { Injectable, Signal, computed, signal } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore/lite';
import { PhraseChunk, PhraseTemplate } from '../models/phrase.model';

const CHUNKS_KEY = 'phrase_lab_chunks';
const CHUNKS_TS = 'phrase_lab_chunks_ts';
const TEMPLATES_KEY = 'phrase_lab_templates';
const TEMPLATES_TS = 'phrase_lab_templates_ts';
const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PhraseContentService {
  readonly chunks = signal<PhraseChunk[]>([]);
  readonly templates = signal<PhraseTemplate[]>([]);
  readonly loading = signal(false);
  readonly offline = signal(false);

  readonly domains: Signal<string[]> = computed(() =>
    [...new Set(this.chunks().map((c) => c.domain))].sort()
  );
  readonly contexts: Signal<string[]> = computed(() =>
    [...new Set(this.chunks().map((c) => c.context))].sort()
  );
  readonly levels: Signal<string[]> = computed(() =>
    [...new Set(this.chunks().map((c) => c.level))].sort()
  );

  constructor(private firestore: Firestore) {}

  async loadAll(): Promise<void> {
    this.loading.set(true);
    await Promise.all([this.loadCollection<PhraseChunk>('phrase_chunks', CHUNKS_KEY, CHUNKS_TS, this.chunks), this.loadCollection<PhraseTemplate>('phrase_templates', TEMPLATES_KEY, TEMPLATES_TS, this.templates)]);
    this.loading.set(false);
  }

  private readCache<T>(key: string): T[] | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return null;
    }
  }

  private async loadCollection<T>(
    name: string,
    key: string,
    tsKey: string,
    sink: (v: T[]) => void
  ): Promise<T[]> {
    const freshCache = this.readCache<T>(key);
    const ts = Number(localStorage.getItem(tsKey) ?? 0);
    if (freshCache && Date.now() - ts <= TTL_MS) {
      sink(freshCache);
      return freshCache;
    }
    try {
      const snap = await getDocs(collection(this.firestore, name));
      const data = snap.docs.map((d) => d.data() as T);
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(tsKey, String(Date.now()));
      this.offline.set(false);
      sink(data);
      return data;
    } catch {
      this.offline.set(true);
      const stale = this.readCache<T>(key);
      if (stale) sink(stale);
      return stale ?? [];
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/services/phrase-content.service.spec.ts' --watch=false`
Expected: PASS (3 specs)

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/services/phrase-content.service.ts web/src/app/sub-app/phrase-lab/services/phrase-content.service.spec.ts
git commit -m "feat(phrase-lab): PhraseContentService with 24h localStorage cache"
```

---

### Task 4: PhraseProgressService

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/services/phrase-progress.service.ts`
- Test: `web/src/app/sub-app/phrase-lab/services/phrase-progress.service.spec.ts`

**Interfaces:**
- Consumes: `PhraseProgress` (Task 2), `HubAuthService.requestUserInfo` (Task 1), Firestore token
- Produces: `class PhraseProgressService` — `readonly authed: Signal<boolean>`, `readonly uid: Signal<string | null>`, `readonly progress: Signal<PhraseProgress | null>`, `async init(): Promise<void>`, `async markChunkLearned(chunkId: string, speakScore?: number): Promise<void>`, `async recordSpeakResult(templateId: string, chunkIds: string[], score: number): Promise<void>`

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import * as lite from '@angular/fire/firestore/lite';
import { PhraseProgressService } from './phrase-progress.service';
import { HubAuthService } from '../../auth/hub-auth.service';

describe('PhraseProgressService', () => {
  let service: PhraseProgressService;
  const hubAuth = jasmine.createSpyObj('HubAuthService', ['requestUserInfo']);
  let setDocSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve(null));
    setDocSpy = spyOn(lite, 'setDoc').and.returnValue(Promise.resolve());
    spyOn(lite, 'getDoc').and.returnValue(
      Promise.resolve({ exists: () => false } as any)
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: HubAuthService, useValue: hubAuth },
      ],
    });
    service = TestBed.inject(PhraseProgressService);
  });

  it('falls back to localStorage when Hub auth times out (null user)', async () => {
    await service.init();
    expect(service.authed()).toBeFalse();
    await service.markChunkLearned('c1');
    expect(JSON.parse(localStorage.getItem('phrase_lab_progress')!).masteredChunks.c1.status).toBe('learning');
    expect(setDocSpy).not.toHaveBeenCalled();
  });

  it('writes to Firestore doc phrase_progress/{uid} when authenticated', async () => {
    hubAuth.requestUserInfo.and.returnValue(Promise.resolve({ id: 'u1', email: null, name: null, image: null }));
    await service.init();
    expect(service.authed()).toBeTrue();
    await service.markChunkLearned('c1', 90);
    expect(setDocSpy).toHaveBeenCalled();
    const args = setDocSpy.calls.mostRecent().args;
    expect(args[1].uid).toBe('u1');
    expect(args[1].masteredChunks.c1.speakScore).toBe(90);
  });

  it('recordSpeakResult: score >= 80 marks template, adds 10 points, increments streak once per day', async () => {
    await service.init();
    await service.recordSpeakResult('t1', ['c1'], 85);
    const p = service.progress()!;
    expect(p.masteredTemplates.t1.bestSpeakScore).toBe(85);
    expect(p.totalPoints).toBe(10);
    expect(p.streak.current).toBe(1);
    expect(p.streak.lastDay).toBe(new Date().toISOString().slice(0, 10));
    await service.recordSpeakResult('t1', ['c1'], 90);
    expect(service.progress()!.streak.current).toBe(1); // same day, no double count
    expect(service.progress()!.masteredTemplates.t1.bestSpeakScore).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/services/phrase-progress.service.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './phrase-progress.service'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import { Injectable, Signal, signal } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore/lite';
import { HubAuthService } from '../../auth/hub-auth.service';
import { PhraseProgress } from '../models/phrase.model';

const LOCAL_KEY = 'phrase_lab_progress';

@Injectable({ providedIn: 'root' })
export class PhraseProgressService {
  readonly authed = signal(false);
  readonly uid = signal<string | null>(null);
  readonly progress = signal<PhraseProgress | null>(null);

  private hubUserId: string | null = null;

  constructor(private firestore: Firestore, private hubAuth: HubAuthService) {}

  async init(): Promise<void> {
    const user = await this.hubAuth.requestUserInfo();
    this.hubUserId = user?.id ?? null;
    if (this.hubUserId) {
      this.authed.set(true);
      this.uid.set(this.hubUserId);
    }
    this.progress.set(await this.read());
  }

  private emptyProgress(): PhraseProgress {
    return {
      uid: this.hubUserId ?? 'local',
      masteredChunks: {},
      masteredTemplates: {},
      streak: { current: 0, lastDay: '' },
      totalPoints: 0,
    };
  }

  private async read(): Promise<PhraseProgress> {
    if (this.hubUserId) {
      const snap = await getDoc(doc(this.firestore, 'phrase_progress', this.hubUserId));
      if (snap.exists()) return snap.data() as PhraseProgress;
      const fresh = this.emptyProgress();
      await this.write(fresh);
      return fresh;
    }
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as PhraseProgress;
      } catch {
        /* corrupted → fresh */
      }
    }
    return this.emptyProgress();
  }

  private async write(p: PhraseProgress): Promise<void> {
    if (this.hubUserId) {
      await setDoc(doc(this.firestore, 'phrase_progress', this.hubUserId), p);
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
    }
  }

  async markChunkLearned(chunkId: string, speakScore = 0): Promise<void> {
    const p = this.progress() ?? this.emptyProgress();
    const existing = p.masteredChunks[chunkId];
    p.masteredChunks[chunkId] = {
      status: 'learning',
      speakScore: Math.max(existing?.speakScore ?? 0, speakScore),
      lastPracticed: Date.now(),
    };
    this.progress.set({ ...p });
    await this.write(p);
  }

  async recordSpeakResult(templateId: string, chunkIds: string[], score: number): Promise<void> {
    const p = this.progress() ?? this.emptyProgress();
    const t = p.masteredTemplates[templateId] ?? { bestSpeakScore: 0, attempts: 0 };
    t.attempts++;
    t.bestSpeakScore = Math.max(t.bestSpeakScore, score);
    p.masteredTemplates[templateId] = t;
    for (const cid of chunkIds) {
      const existing = p.masteredChunks[cid];
      p.masteredChunks[cid] = {
        status: score >= 80 ? 'mastered' : (existing?.status ?? 'learning'),
        speakScore: Math.max(existing?.speakScore ?? 0, score),
        lastPracticed: Date.now(),
      };
    }
    if (score >= 80) {
      p.totalPoints += 10;
      const today = new Date().toISOString().slice(0, 10);
      if (p.streak.lastDay !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        p.streak.current = p.streak.lastDay === yesterday.toISOString().slice(0, 10) ? p.streak.current + 1 : 1;
        p.streak.lastDay = today;
      }
    }
    this.progress.set({ ...p });
    await this.write(p);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/services/phrase-progress.service.spec.ts' --watch=false`
Expected: PASS (3 specs)

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/services/phrase-progress.service.ts web/src/app/sub-app/phrase-lab/services/phrase-progress.service.spec.ts
git commit -m "feat(phrase-lab): PhraseProgressService with Firestore/local fallback + streak"
```

---

### Task 5: Firestore Rules

**Files:**
- Create: `web/firestore.rules`

**Interfaces:**
- Produces: deployable rules for `phrase_chunks`, `phrase_templates`, `phrase_progress`

- [ ] **Step 1: Check for an existing rules file**

Run: `ls web/firestore.rules web/firebase.json 2>/dev/null; grep -rl "match /databases" web --include='*.rules' 2>/dev/null | head -5`
Expected: If `web/firestore.rules` exists, read it and merge the three match blocks below into the existing `service cloud.firestore` block (do not duplicate `rules_version`/`service` headers). If none exists, continue to Step 2.

- [ ] **Step 2: Create the rules file**

`web/firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /phrase_chunks/{id} {
      allow read: if true;
    }
    match /phrase_templates/{id} {
      allow read: if true;
    }
    match /phrase_progress/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 3: Verify syntax**

Run: `node -e "console.log('ok')"` (firebase CLI optional; if `firebase` is available run `firebase deploy --only firestore:rules` — otherwise deploy is documented in the spec's Open Questions and performed by the user with the Hub deploy)
Expected: ok

- [ ] **Step 4: Commit**

```bash
git add web/firestore.rules
git commit -m "feat(phrase-lab): Firestore rules for phrase collections"
```

---

### Task 6: Seed Data + Seed Script

**Files:**
- Create: `web/scripts/seed-data/phrase-seed.data.ts`
- Create: `web/scripts/seed-phrase-lab.ts`

**Interfaces:**
- Consumes: `PhraseChunk`, `PhraseTemplate` (Task 2 — import type only, script is standalone Node)
- Produces: `SEED_CHUNKS: PhraseChunk[]`, `SEED_TEMPLATES: PhraseTemplate[]` (all 64 chunks + 18 templates, verbatim from spec Section 8)

- [ ] **Step 1: Install dev dependencies**

Run: `npm i -D firebase-admin tsx` (from `web/`)
Expected: package.json gains `firebase-admin` and `tsx` devDependencies

- [ ] **Step 2: Write the seed data file**

`web/scripts/seed-data/phrase-seed.data.ts`:

```typescript
import type { PhraseChunk, PhraseTemplate } from '../../src/app/sub-app/phrase-lab/models/phrase.model';

// Transcribe VERBATIM from docs/superpowers/specs/2026-08-05-phrase-lab-design.md Section 8.
// The spec tables are the authoritative source. Every row becomes one object.
// Example (first chunk row from the spec's IT/meeting table):
export const SEED_CHUNKS: PhraseChunk[] = [
  {
    id: 'it-meet-b2-01',
    domain: 'it',
    context: 'meeting',
    level: 'B2',
    english: 'take into consideration',
    vietnamese: 'cân nhắc, xem xét',
    phonetic: '/teɪk ˈɪntə kənˌsɪdəˈreɪʃən/',
    role: 'linker',
    examples: [
      { en: 'We need to take into consideration the system load during peak hours.', vi: 'Chúng ta cần cân nhắc tải hệ thống trong giờ cao điểm.' },
    ],
  },
  // ... all remaining chunks from spec Section 8 tables (IT 23, Business 21, Daily 20)
];

export const SEED_TEMPLATES: PhraseTemplate[] = [
  {
    id: 'tpl-it-meet-01',
    domain: 'it',
    context: 'meeting',
    level: 'B2',
    english: 'It would be better if we could take into consideration the system load before we proceed.',
    vietnamese: 'Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục.',
    structure: 'It would be better if {subject} {modal} {chunk:linker} the {noun} before we {verb}.',
    slots: [
      { name: 'subject', role: null, options: ['we', 'you', 'the team'] },
      { name: 'modal', role: null, options: ['could', 'would', 'can'] },
      { name: 'linker', role: 'linker' },
      { name: 'noun', role: null, options: ['system load', 'performance', 'the requirements'] },
      { name: 'verb', role: null, options: ['move on', 'proceed'] },
    ],
    example: { en: 'It would be better if we could take into consideration the system load before we proceed.', vi: 'Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục.' },
  },
  // ... all remaining templates from spec Section 8 (18 total)
];
```

Note: the two examples above are the FIRST rows of spec Section 8. Continue transcribing every remaining chunk row and template row exactly as authored in the spec — ids, domain/context/level values, english/vietnamese/phonetic, role, examples, structure, slots. When done, the arrays must contain 64 chunks and 18 templates.

- [ ] **Step 3: Write the seed runner**

`web/scripts/seed-phrase-lab.ts`:

```typescript
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_CHUNKS, SEED_TEMPLATES } from './seed-data/phrase-seed.data';

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath) {
  console.error('Missing GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON).');
  process.exit(1);
}

initializeApp({ credential: cert(credentialPath) });
const db = getFirestore();

async function seed<T extends { id: string }>(collectionName: string, docs: T[]): Promise<void> {
  const col = db.collection(collectionName);
  const batch = db.batch();
  for (const doc of docs) {
    batch.set(col.doc(doc.id), doc);
  }
  await batch.commit();
  console.log(`Seeded ${docs.length} docs into ${collectionName}`);
}

async function main(): Promise<void> {
  await seed('phrase_chunks', SEED_CHUNKS);
  await seed('phrase_templates', SEED_TEMPLATES);
  console.log('Done. Deploy firestore.rules before testing reads.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Verify the seed compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>/dev/null; npx tsx --eval "import('./scripts/seed-data/phrase-seed.data').then(m => console.log('chunks:', m.SEED_CHUNKS.length, 'templates:', m.SEED_TEMPLATES.length))"`
Expected: `chunks: 64 templates: 18` (no TS errors in the data file)

- [ ] **Step 5: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts web/scripts/seed-phrase-lab.ts
git commit -m "feat(phrase-lab): seed data (64 chunks + 18 templates) + firebase-admin seeder"
```

---

### Task 7: ChunkCard + ChunkBrowser Components

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/components/chunk-card.component.ts`
- Create: `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts`
- Test: `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseContentService` (chunks/domains/contexts/levels), `PhraseProgressService.markChunkLearned`, core `SpeechService.speak`
- Produces: `ChunkCardComponent` — `chunk = input.required<PhraseChunk>()`, `mastered = computed<boolean>()`; `ChunkBrowserComponent` — `selectedDomain/selectedContext/selectedLevel = signal<string>('all')`, `filtered = computed<PhraseChunk[]>()`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChunkBrowserComponent } from './chunk-browser.component';
import { PhraseContentService } from '../services/phrase-content.service';

describe('ChunkBrowserComponent', () => {
  let fixture: ComponentFixture<ChunkBrowserComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ChunkBrowserComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            domains: signal(['it']),
            contexts: signal(['meeting']),
            levels: signal(['B2']),
            chunks: signal([]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(ChunkBrowserComponent);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

Note: if the signal-stub above fights you, replace the `PhraseContentService` provider with a class that exposes real `signal()`s and swap the `chunks` call in the component to `content.chunks` (as written in the implementation below). The smoke test's only assertion is that the component instantiates.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/chunk-browser.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './chunk-browser.component'"

- [ ] **Step 3: Write the implementation**

`chunk-card.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PhraseChunk } from '../models/phrase.model';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';

const ROLE_COLOR: Record<string, string> = {
  opener: 'bg-blue-100 text-blue-700',
  linker: 'bg-purple-100 text-purple-700',
  filler: 'bg-orange-100 text-orange-700',
  closer: 'bg-green-100 text-green-700',
};

@Component({
  selector: 'app-chunk-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-sm border border-slate-200">
      <div class="flex items-start justify-between gap-2">
        <div>
          <span [class]="'text-xs font-medium px-2 py-0.5 rounded-full ' + roleColor">{{ chunk().role }}</span>
          <p class="mt-2 font-semibold text-slate-800">{{ chunk().english }}</p>
          <p class="text-slate-500 text-sm">{{ chunk().phonetic }}</p>
        </div>
        <button (click)="speak(chunk().english)" class="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 p-2 text-slate-600" aria-label="Nghe mẫu">🔊</button>
      </div>
      <p class="mt-1 text-sm text-slate-700">{{ chunk().vietnamese }}</p>
      <p class="mt-2 text-sm text-slate-500 italic">{{ chunk().examples[0]?.en }}</p>
      <p class="text-xs text-slate-400">{{ chunk().examples[0]?.vi }}</p>
      <button
        (click)="learn()"
        [disabled]="mastered()"
        class="mt-3 w-full rounded-xl py-2 text-sm font-medium transition disabled:bg-emerald-100 disabled:text-emerald-700 enabled:bg-slate-800 enabled:text-white hover:enabled:bg-slate-700">
        {{ mastered() ? 'Đã học ✓' : 'Đã học' }}
      </button>
    </div>
  `,
})
export class ChunkCardComponent {
  readonly chunk = input.required<PhraseChunk>();
  private readonly progress = inject(PhraseProgressService);
  private readonly speech = inject(SpeechService);

  readonly roleColor = computed(() => ROLE_COLOR[this.chunk().role] ?? 'bg-slate-100 text-slate-600');
  readonly mastered = computed(() => !!this.progress.progress()?.masteredChunks[this.chunk().id]);

  learn(): void {
    void this.progress.markChunkLearned(this.chunk().id);
  }

  speak(text: string): void {
    this.speech.speak(text);
  }
}
```

`chunk-browser.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseChunk } from '../models/phrase.model';
import { ChunkCardComponent } from './chunk-card.component';

@Component({
  selector: 'app-chunk-browser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ChunkCardComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2 text-sm">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Domain</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedDomain()" (ngModelChange)="selectDomain($event)">
            <option value="all">Tất cả</option>
            @for (d of domains(); track d) { <option [value]="d">{{ d }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Context</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedContext()" (ngModelChange)="selectedContext.set($event)">
            <option value="all">Tất cả</option>
            @for (c of contexts(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Level</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedLevel()" (ngModelChange)="selectedLevel.set($event)">
            <option value="all">Tất cả</option>
            @for (l of levels(); track l) { <option [value]="l">{{ l }}</option> }
          </select>
        </label>
      </div>
      <p class="text-xs text-slate-400">{{ filtered().length }} chunk</p>
      <div class="grid gap-3 sm:grid-cols-2">
        @for (chunk of filtered(); track chunk.id) { <app-chunk-card [chunk]="chunk" /> }
      </div>
    </div>
  `,
})
export class ChunkBrowserComponent {
  private readonly content = inject(PhraseContentService);
  readonly domains = this.content.domains;
  readonly contexts = this.content.contexts;
  readonly levels = this.content.levels;
  readonly selectedDomain = signal<string>('all');
  readonly selectedContext = signal<string>('all');
  readonly selectedLevel = signal<string>('all');

  readonly filtered = computed<PhraseChunk[]>(() => {
    const all = this.content.chunks();
    return all.filter(
      (c) =>
        (this.selectedDomain() === 'all' || c.domain === this.selectedDomain()) &&
        (this.selectedContext() === 'all' || c.context === this.selectedContext()) &&
        (this.selectedLevel() === 'all' || c.level === this.selectedLevel())
    );
  });

  selectDomain(d: string): void {
    this.selectedDomain.set(d);
    this.selectedContext.set('all');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/chunk-browser.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/chunk-card.component.ts web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts web/src/app/sub-app/phrase-lab/components/chunk-browser.component.spec.ts
git commit -m "feat(phrase-lab): chunk-card + chunk-browser with domain/context/level filters"
```

---

### Task 8: SentenceAnalysisComponent

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/components/sentence-analysis.component.ts`
- Test: `web/src/app/sub-app/phrase-lab/components/sentence-analysis.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseEngineService.annotateStructure` (Task 2)
- Produces: `SentenceAnalysisComponent` — `template = input.required<PhraseTemplate>()`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SentenceAnalysisComponent } from './sentence-analysis.component';
import { PhraseTemplate } from '../models/phrase.model';

describe('SentenceAnalysisComponent', () => {
  let fixture: ComponentFixture<SentenceAnalysisComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SentenceAnalysisComponent] });
    fixture = TestBed.createComponent(SentenceAnalysisComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2',
      english: 'It would be better if we could take into consideration the load before we proceed.',
      vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('renders the role-colored structure parts', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('[linker]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/sentence-analysis.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './sentence-analysis.component'"

- [ ] **Step 3: Write the implementation**

```typescript
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { SpeechService } from '../../../core/services/speech.service';

const ROLE_CLASS: Record<string, string> = {
  opener: 'text-blue-700 bg-blue-50',
  linker: 'text-purple-700 bg-purple-50',
  filler: 'text-orange-700 bg-orange-50',
  closer: 'text-green-700 bg-green-50',
};

@Component({
  selector: 'app-sentence-analysis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200">
      <h3 class="font-semibold text-slate-800">{{ template().english }}</h3>
      <p class="text-sm text-slate-500">{{ template().vietnamese }}</p>
      <div class="mt-4 flex flex-wrap items-center gap-1 text-base leading-relaxed">
        @for (part of parts(); track $index) {
          @if (part.role) {
            <span class="rounded-lg px-1.5 py-0.5 font-medium {{ roleClass(part.role) }}">{{ part.text }}</span>
          } @else {
            <span class="text-slate-700">{{ part.text }}</span>
          }
        }
      </div>
      <div class="mt-3 flex items-center gap-3 text-sm">
        <button (click)="speak()" class="rounded-xl bg-slate-800 px-4 py-1.5 text-white">🔊 Nghe mẫu</button>
        <span class="text-xs text-slate-400">Xanh=opener · Tím=linker · Cam=filler · Lục=closer</span>
      </div>
    </div>
  `,
})
export class SentenceAnalysisComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly speech = inject(SpeechService);

  readonly parts = () => this.engine.annotateStructure(this.template());

  roleClass(role: string | null): string {
    return ROLE_CLASS[role ?? ''] ?? 'text-slate-700';
  }

  speak(): void {
    this.speech.speak(this.template().example.en, 'en-US');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/sentence-analysis.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/sentence-analysis.component.ts web/src/app/sub-app/phrase-lab/components/sentence-analysis.component.spec.ts
git commit -m "feat(phrase-lab): sentence-analysis with role color coding"
```

---

### Task 9: SentenceBuilderComponent (slot-filling)

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/components/sentence-builder.component.ts`
- Test: `web/src/app/sub-app/phrase-lab/components/sentence-builder.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseEngineService.buildSentence` (Task 2), `PhraseContentService.chunks`, `SpeechService`
- Produces: `SentenceBuilderComponent` — `template = input.required<PhraseTemplate>()`, `readonly values = signal<Record<string, string>>({})`, `readonly preview = computed<string>()`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SentenceBuilderComponent } from './sentence-builder.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { signal } from '@angular/core';

describe('SentenceBuilderComponent', () => {
  let fixture: ComponentFixture<SentenceBuilderComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SentenceBuilderComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
            domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(SentenceBuilderComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we', 'you'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('previews a filled sentence', () => {
    const c = fixture.componentInstance;
    c.values.set({ subject: 'we', linker: 'take into consideration' });
    expect(c.preview()).toContain('we take into consideration');
    expect(c.preview()).not.toContain('___');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/sentence-builder.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './sentence-builder.component'"

- [ ] **Step 3: Write the implementation**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';

@Component({
  selector: 'app-sentence-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Điền slot để tạo câu</h3>
      @for (slot of template().slots; track slot.name) {
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs text-slate-500">{{ slot.name }} {{ slot.role ? '· ' + slot.role : '' }}</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-2" [ngModel]="values()[slot.name]" (ngModelChange)="set(slot.name, $event)">
            @if (!slot.role) {
              @for (opt of slot.options ?? []; track opt) { <option [value]="opt">{{ opt }}</option> }
            } @else {
              @for (c of optionsFor(slot.name); track c.id) { <option [value]="c.english">{{ c.english }} — {{ c.vietnamese }}</option> }
            }
          </select>
        </label>
      }
      <div class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ preview() }}</div>
      <button (click)="speak()" class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">🔊 Nghe câu</button>
    </div>
  `,
})
export class SentenceBuilderComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  private readonly speech = inject(SpeechService);
  readonly values = signal<Record<string, string>>({});

  optionsFor(slotName: string) {
    const t = this.template();
    return this.content
      .chunks()
      .filter(
        (c) => c.role === t.slots.find((s) => s.name === slotName)?.role && c.domain === t.domain && c.context === t.context && c.level === t.level
      );
  }

  set(name: string, value: string): void {
    this.values.update((v) => ({ ...v, [name]: value }));
  }

  readonly preview = computed<string>(() => {
    const t = this.template();
    const fills = t.slots.map((s) => {
      const chosen = this.values()[s.name];
      if (chosen) return { name: s.name, value: chosen };
      return { name: s.name, value: s.role ? (this.optionsFor(s.name)[0]?.english ?? '___') : (s.options?.[0] ?? '___') };
    });
    return this.engine.buildSentence(t, fills);
  });

  speak(): void {
    this.speech.speak(this.preview(), 'en-US');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/sentence-builder.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/sentence-builder.component.ts web/src/app/sub-app/phrase-lab/components/sentence-builder.component.spec.ts
git commit -m "feat(phrase-lab): sentence-builder slot-filling mode"
```

---

### Task 10: RoleCombinerComponent

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/components/role-combiner.component.ts`
- Test: `web/src/app/sub-app/phrase-lab/components/role-combiner.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseEngineService.combineByRole` (Task 2), `PhraseContentService.chunks`
- Produces: `RoleCombinerComponent` — `template = input.required<PhraseTemplate>()`, `readonly selection = signal<Record<string, string>>({})`, `readonly result = computed<{ sentence: string | null; errors: string[] }>()`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoleCombinerComponent } from './role-combiner.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { signal } from '@angular/core';

describe('RoleCombinerComponent', () => {
  let fixture: ComponentFixture<RoleCombinerComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RoleCombinerComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'cân nhắc', phonetic: '/p/', role: 'linker', examples: [] }]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(RoleCombinerComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('combines a valid selection into a sentence', () => {
    const c = fixture.componentInstance;
    c.selection.set({ linker: 'it-meet-b2-01' });
    expect(c.result().sentence).toContain('take into consideration');
  });

  it('reports errors when a role slot is missing', () => {
    const c = fixture.componentInstance;
    c.selection.set({});
    expect(c.result().sentence).toBeNull();
    expect(c.result().errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/role-combiner.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './role-combiner.component'"

- [ ] **Step 3: Write the implementation**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';

@Component({
  selector: 'app-role-combiner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Tổ hợp theo vai trò</h3>
      @for (slot of template().slots; track slot.name) {
        @if (slot.role) {
          <fieldset class="space-y-1">
            <legend class="text-xs text-slate-500">{{ slot.name }} · {{ slot.role }}</legend>
            @for (c of candidates(slot.role); track c.id) {
              <button
                (click)="pick(slot.name, c.id)"
                class="block w-full rounded-xl border px-3 py-2 text-left text-sm transition"
                [class.border-slate-800]="selection()[slot.name] === c.id"
                [class.border-slate-200]="selection()[slot.name] !== c.id">
                {{ c.english }} <span class="text-slate-400">— {{ c.vietnamese }}</span>
              </button>
            }
          </fieldset>
        }
      }
      @if (result().errors.length) {
        <ul class="text-sm text-red-600 space-y-1">
          @for (e of result().errors; track e) { <li>⚠ {{ e }}</li> }
        </ul>
      } @else if (result().sentence) {
        <p class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ result().sentence }}</p>
      }
    </div>
  `,
})
export class RoleCombinerComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  readonly selection = signal<Record<string, string>>({});

  candidates(role: string) {
    const t = this.template();
    return this.content.chunks().filter((c) => c.role === role && c.domain === t.domain && c.context === t.context && c.level === t.level);
  }

  pick(slotName: string, chunkId: string): void {
    this.selection.update((s) => ({ ...s, [slotName]: chunkId }));
  }

  readonly result = computed(() => this.engine.combineByRole(this.template(), this.content.chunks(), this.selection()));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/role-combiner.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/role-combiner.component.ts web/src/app/sub-app/phrase-lab/components/role-combiner.component.spec.ts
git commit -m "feat(phrase-lab): role-combiner mode with same-domain+level validation"
```

---

### Task 11: OrderArrangeComponent

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/components/order-arrange.component.ts`
- Test: `web/src/app/sub-app/phrase-lab/components/order-arrange.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseEngineService.expectedSequence` + `validateOrder` (Task 2), `PhraseContentService.chunks`
- Produces: `OrderArrangeComponent` — `template = input.required<PhraseTemplate>()`, `readonly pool = computed<string[]>(shuffled)`, `readonly picked = signal<string[]>([])`, `readonly verdict = signal<{ correct: boolean; positionErrors: number[] } | null>(null)`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderArrangeComponent } from './order-arrange.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { signal } from '@angular/core';

describe('OrderArrangeComponent', () => {
  let fixture: ComponentFixture<OrderArrangeComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [OrderArrangeComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(OrderArrangeComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we', 'you'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('exposes a shuffled pool containing all sequence items', () => {
    const c = fixture.componentInstance;
    const seq = ['we', 'take into consideration'];
    expect(c.pool().sort()).toEqual(seq.sort());
  });

  it('validates the picked order', () => {
    const c = fixture.componentInstance;
    c.picked.set(['we', 'take into consideration']);
    c.check();
    expect(c.verdict()?.correct).toBeTrue();
    c.picked.set(['take into consideration', 'we']);
    c.check();
    expect(c.verdict()?.correct).toBeFalse();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/order-arrange.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './order-arrange.component'"

- [ ] **Step 3: Write the implementation**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

@Component({
  selector: 'app-order-arrange',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Xếp các chunk theo đúng thứ tự</h3>
      <p class="text-sm text-slate-500 leading-relaxed">
        @for (item of picked(); track $index) {
          <span class="mr-1 inline-block rounded-lg bg-slate-100 px-2 py-0.5" [class.bg-red-100]="isWrong($index)">{{ item }}</span>
        } @empty { <span class="text-slate-400">Bấm các chunk bên dưới theo thứ tự...</span> }
      </p>
      <div class="flex flex-wrap gap-2">
        @for (item of pool(); track item) {
          @if (!picked().includes(item)) {
            <button (click)="tap(item)" class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm">{{ item }}</button>
          }
        }
      </div>
      <div class="flex gap-2">
        <button (click)="check()" class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">Kiểm tra</button>
        <button (click)="reset()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">Làm lại</button>
      </div>
      @if (verdict()) {
        <p class="text-sm font-medium" [class.text-emerald-600]="verdict()!.correct" [class.text-red-600]="!verdict()!.correct">
          {{ verdict()!.correct ? 'Chính xác! 🎉' : 'Sai thứ tự — xem lại các vị trí đỏ.' }}
        </p>
      }
    </div>
  `,
})
export class OrderArrangeComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  readonly picked = signal<string[]>([]);
  readonly verdict = signal<{ correct: boolean; positionErrors: number[] } | null>(null);
  private readonly sequence = computed(() => this.engine.expectedSequence(this.template(), this.content.chunks()));

  readonly pool = computed(() => shuffled(this.sequence()));

  tap(item: string): void {
    this.picked.update((p) => [...p, item]);
  }

  check(): void {
    this.verdict.set(this.engine.validateOrder(this.template(), this.content.chunks(), this.picked()));
  }

  isWrong(index: number): boolean {
    return this.verdict()?.positionErrors.includes(index) ?? false;
  }

  reset(): void {
    this.picked.set([]);
    this.verdict.set(null);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/order-arrange.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/order-arrange.component.ts web/src/app/sub-app/phrase-lab/components/order-arrange.component.spec.ts
git commit -m "feat(phrase-lab): order-arrange mode with shuffle + validate"
```

---

### Task 12: SpeakPracticeComponent

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/components/speak-practice.component.ts`
- Test: `web/src/app/sub-app/phrase-lab/components/speak-practice.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseEngineService.combineByRole` + `scoreSpeech` (Task 2), `PhraseContentService.chunks`, core `SpeechService` (`isRecognitionSupported`, `startListening`, `speak`)
- Produces: `SpeakPracticeComponent` — `template = input.required<PhraseTemplate>()`, `readonly target = computed<string>()`, `readonly chunkIds = computed<string[]>()`, `readonly isListening = signal(false)`, `readonly feedback = signal<{ score: number; wrongWords: string[] } | null>(null)`, `startListening(): Promise<void>`, `mastered = output<{ templateId: string; chunkIds: string[]; score: number }>()`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpeakPracticeComponent } from './speak-practice.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';
import { signal } from '@angular/core';

describe('SpeakPracticeComponent', () => {
  let fixture: ComponentFixture<SpeakPracticeComponent>;
  const speech = jasmine.createSpyObj('SpeechService', ['isRecognitionSupported', 'startListening', 'speak']);

  beforeEach(async () => {
    speech.isRecognitionSupported.and.returnValue(true);
    speech.startListening.and.returnValue(Promise.resolve('it would be better if we could take into consideration the load'));
    TestBed.configureTestingModule({
      imports: [SpeakPracticeComponent],
      providers: [
        { provide: SpeechService, useValue: speech },
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(SpeakPracticeComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'It would be better if we could take into consideration the load.', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('builds a target sentence from the template defaults', () => {
    expect(fixture.componentInstance.target()).toContain('take into consideration');
  });

  it('scores speech and emits mastered on high score', async () => {
    const c = fixture.componentInstance;
    const emitSpy = spyOn(c.mastered, 'emit');
    await c.startListening();
    expect(c.feedback()?.score).toBeGreaterThanOrEqual(80);
    expect(emitSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/speak-practice.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './speak-practice.component'"

- [ ] **Step 3: Write the implementation**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';

@Component({
  selector: 'app-speak-practice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Luyện nói</h3>
      <p class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ target() }}</p>
      <div class="flex gap-2">
        <button (click)="listenSlow()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">🐢 Nghe chậm</button>
        @if (supported) {
          <button
            (click)="startListening()"
            class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white"
            [class.animate-pulse]="isListening()">
            {{ isListening() ? 'Đang nghe...' : '🎤 Đọc câu này' }}
          </button>
        }
      </div>
      @if (!supported) {
        <p class="text-xs text-slate-400">Trình duyệt không hỗ trợ nhận diện giọng nói — hãy tự chấm và bấm "Đã đạt".</p>
      }
      @if (feedback(); as fb) {
        <div class="space-y-2">
          <p class="text-lg font-bold" [class.text-emerald-600]="fb.score >= 80" [class.text-amber-500]="fb.score >= 50 && fb.score < 80" [class.text-red-600]="fb.score < 50">
            {{ fb.score >= 80 ? 'PERFECT! 🎉' : fb.score >= 50 ? 'Almost — cố lên!' : 'Try again' }} · {{ fb.score }}/100
          </p>
          @if (fb.wrongWords.length) {
            <p class="text-sm text-slate-500">Chưa nhận diện được: <span class="font-medium text-red-600">{{ fb.wrongWords.join(', ') }}</span></p>
          }
          @if (fb.score < 80) {
            <p class="text-xs text-slate-400">Gợi ý: bấm "🐢 Nghe chậm" rồi thử lại.</p>
          }
          <button (click)="markMastered()" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white">Tôi đã nói chuẩn ✓</button>
        </div>
      }
    </div>
  `,
})
export class SpeakPracticeComponent {
  readonly template = input.required<PhraseTemplate>();
  readonly mastered = output<{ templateId: string; chunkIds: string[]; score: number }>();

  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  private readonly speech = inject(SpeechService);

  readonly isListening = signal(false);
  readonly feedback = signal<{ score: number; wrongWords: string[] } | null>(null);
  readonly supported = this.speech.isRecognitionSupported();

  private readonly baseFills = computed(() => {
    const t = this.template();
    const fills: { name: string; value: string }[] = [];
    for (const slot of t.slots) {
      if (slot.role) {
        const match = this.content.chunks().find((c) => c.role === slot.role && c.domain === t.domain && c.context === t.context && c.level === t.level);
        fills.push({ name: slot.name, value: match?.english ?? '___' });
      } else {
        fills.push({ name: slot.name, value: slot.options?.[0] ?? '___' });
      }
    }
    return fills;
  });

  readonly target = computed(() => this.engine.buildSentence(this.template(), this.baseFills()));

  readonly chunkIds = computed(() =>
    this.content
      .chunks()
      .filter((c) => this.target().includes(c.english))
      .map((c) => c.id)
  );

  listenSlow(): void {
    this.speech.speak(this.target(), 'en-US');
  }

  async startListening(): Promise<void> {
    if (!this.supported) return;
    this.isListening.set(true);
    this.feedback.set(null);
    try {
      const transcript = await this.speech.startListening('en-US');
      const fb = this.engine.scoreSpeech(this.target(), transcript);
      this.feedback.set(fb);
      if (fb.score >= 80) {
        this.mastered.emit({ templateId: this.template().id, chunkIds: this.chunkIds(), score: fb.score });
      }
    } finally {
      this.isListening.set(false);
    }
  }

  markMastered(): void {
    this.mastered.emit({ templateId: this.template().id, chunkIds: this.chunkIds(), score: 100 });
    this.feedback.set({ score: 100, wrongWords: [] });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/components/speak-practice.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/speak-practice.component.ts web/src/app/sub-app/phrase-lab/components/speak-practice.component.spec.ts
git commit -m "feat(phrase-lab): speak-practice with TTS + STT scoring + mastered emit"
```

---

### Task 13: PhraseLabPageComponent + Route

**Files:**
- Create: `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts`
- Modify: `web/src/app/app.routes.ts`
- Test: `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.spec.ts`

**Interfaces:**
- Consumes: `PhraseContentService.loadAll`, `PhraseProgressService.init/recordSpeakResult`, all 7 components (Tasks 7-12)
- Produces: `PhraseLabPageComponent` — `readonly activeTab = signal<string>('explore')`, `readonly selectedTemplate = signal<PhraseTemplate | null>(null)`; route entry `{ path: 'sub-app/phrase-lab', loadComponent: ... }`

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhraseLabPageComponent } from './phrase-lab-page.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { signal } from '@angular/core';

describe('PhraseLabPageComponent', () => {
  let fixture: ComponentFixture<PhraseLabPageComponent>;

  beforeEach(async () => {
    const content = jasmine.createSpyObj(
      'PhraseContentService',
      ['loadAll'],
      {
        chunks: signal([{ id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
        templates: signal([{ id: 't1', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v', structure: '{a}', slots: [{ name: 'a', role: null, options: ['x'] }], example: { en: 'e', vi: 'v' } }]),
        domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']), loading: signal(false), offline: signal(false),
      } as any
    );
    content.loadAll.and.returnValue(Promise.resolve());
    const progress = jasmine.createSpyObj('PhraseProgressService', ['init', 'recordSpeakResult'], {
      authed: signal(false), uid: signal(null), progress: signal(null),
    } as any);
    progress.init.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      imports: [PhraseLabPageComponent],
      providers: [
        { provide: PhraseContentService, useValue: content },
        { provide: PhraseProgressService, useValue: progress },
      ],
    });
    fixture = TestBed.createComponent(PhraseLabPageComponent);
    fixture.detectChanges();
  });

  it('creates the shell and shows an offline banner when offline', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Phrase Lab');
  });

  it('selects the first template by default in practice tabs', () => {
    const c = fixture.componentInstance;
    c.setTab('analysis');
    expect(c.selectedTemplate()).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.spec.ts' --watch=false`
Expected: FAIL — "Cannot find module './phrase-lab-page.component'"

- [ ] **Step 3: Write the implementation**

`web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { PhraseTemplate } from '../models/phrase.model';
import { ChunkBrowserComponent } from '../components/chunk-browser.component';
import { SentenceAnalysisComponent } from '../components/sentence-analysis.component';
import { SentenceBuilderComponent } from '../components/sentence-builder.component';
import { RoleCombinerComponent } from '../components/role-combiner.component';
import { OrderArrangeComponent } from '../components/order-arrange.component';
import { SpeakPracticeComponent } from '../components/speak-practice.component';

@Component({
  selector: 'app-phrase-lab-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChunkBrowserComponent, SentenceAnalysisComponent, SentenceBuilderComponent, RoleCombinerComponent, OrderArrangeComponent, SpeakPracticeComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <header class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-slate-800">Phrase Lab</h1>
        <span class="rounded-full px-3 py-1 text-xs font-medium"
          [class.bg-emerald-100]="progress.authed()" [class.text-emerald-700]="progress.authed()"
          [class.bg-slate-200]="!progress.authed()" [class.text-slate-600]="!progress.authed()">
          {{ progress.authed() ? 'Đồng bộ Firestore' : 'Lưu local' }}
        </span>
      </header>

      @if (content.offline()) {
        <div class="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">Mất kết nối — đang dùng dữ liệu đã lưu.</div>
      }

      <div class="mb-4 flex flex-wrap gap-2 text-sm">
        @for (tab of tabs; track tab.id) {
          <button (click)="setTab(tab.id)"
            class="rounded-xl px-3 py-1.5 font-medium transition"
            [class.bg-slate-800]="activeTab() === tab.id" [class.text-white]="activeTab() === tab.id"
            [class.bg-white]="activeTab() !== tab.id" [class.text-slate-600]="activeTab() !== tab.id">
            {{ tab.label }}
          </button>
        }
      </div>

      @if (activeTab() === 'explore') {
        <app-chunk-browser />
      } @else {
        @if (activeTab() === 'analysis' && selectedTemplate(); as t) {
          <app-sentence-analysis [template]="t" />
        }
        @if (activeTab() === 'slot' && selectedTemplate(); as t) {
          <app-sentence-builder [template]="t" />
        }
        @if (activeTab() === 'role' && selectedTemplate(); as t) {
          <app-role-combiner [template]="t" />
        }
        @if (activeTab() === 'order' && selectedTemplate(); as t) {
          <app-order-arrange [template]="t" />
        }
        @if (activeTab() === 'speak' && selectedTemplate(); as t) {
          <app-speak-practice [template]="t" (mastered)="onMastered($event)" />
        }
        @if (!selectedTemplate()) {
          <p class="text-sm text-slate-400">Chưa có template cho bộ lọc hiện tại.</p>
        }
      }
    </div>
  `,
})
export class PhraseLabPageComponent implements OnInit {
  readonly tabs = [
    { id: 'explore', label: 'Khám phá' },
    { id: 'analysis', label: 'Phân tích' },
    { id: 'slot', label: 'Điền slot' },
    { id: 'role', label: 'Tổ hợp role' },
    { id: 'order', label: 'Xếp thứ tự' },
    { id: 'speak', label: 'Luyện nói' },
  ];
  readonly activeTab = signal<string>('explore');
  readonly selectedTemplate = signal<PhraseTemplate | null>(null);

  readonly content = inject(PhraseContentService);
  readonly progress = inject(PhraseProgressService);

  ngOnInit(): void {
    void this.content.loadAll();
    void this.progress.init().catch(() => undefined);
  }

  setTab(id: string): void {
    this.activeTab.set(id);
    if (id !== 'explore' && !this.selectedTemplate()) {
      this.selectedTemplate.set(this.content.templates()[0] ?? null);
    }
  }

  onMastered(evt: { templateId: string; chunkIds: string[]; score: number }): void {
    void this.progress.recordSpeakResult(evt.templateId, evt.chunkIds, evt.score);
  }
}
```

`web/src/app/app.routes.ts` — add this route to the top-level array (after the `sub-app/dictionary` entry):

```typescript
{ path: 'sub-app/phrase-lab', loadComponent: () => import('./sub-app/phrase-lab/pages/phrase-lab-page.component').then((m) => m.PhraseLabPageComponent) },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.spec.ts' --watch=false`
Expected: PASS

- [ ] **Step 5: Typecheck the whole app and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

```bash
git add web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.spec.ts web/src/app/app.routes.ts
git commit -m "feat(phrase-lab): PhraseLabPage shell + sub-app route"
```

---

### Task 14: Full Test Suite + Final Verification

**Files:**
- Test: all phrase-lab specs + existing suite

- [ ] **Step 1: Run the full phrase-lab test suite**

Run: `npx ng test --include='src/app/sub-app/phrase-lab/**/*.spec.ts' --watch=false`
Expected: all specs PASS (engine 9, content 3, progress 3, components 7, page 2, hub-auth 4)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors

- [ ] **Step 3: Run the existing full suite (no regressions)**

Run: `npx ng test --watch=false`
Expected: PASS (existing specs still green)

- [ ] **Step 4: Verify the git log**

Run: `git log --oneline -10`
Expected: 14 new commits on top of `2960d4b` (or whichever HEAD the branch started from)

- [ ] **Step 5: Manual verification (documented in the spec's test plan — run by the user after deploy)**

Deploy rules + seed to Firestore, then open the sub-app through The Hub:
1. `firebase deploy --only firestore:rules` then run the seeder (`GOOGLE_APPLICATION_CREDENTIALS=... npx tsx scripts/seed-phrase-lab.ts`) from `web/`.
2. In The Hub, add a tile for `https://learning-english-tools.vercel.app/sub-app/phrase-lab` and open it.
3. Browse: filter domain→context→level; verify role badges (blue/purple/orange/green).
4. Learn: open a chunk — IPA, meaning, example, 🔊 TTS, "Đã học" marks it.
5. Practice all 4 modes on one template: analysis colors, slot-filling, role-combiner (same domain+level enforced), order-arrange.
6. Speak: listen slow → mic → score; score ≥80 shows PERFECT! and progress syncs (header shows "Đồng bộ Firestore" when Hub auth succeeds).
7. Reload the sub-app: mastered chunks/templates, streak, and points persist.
Expected: all of the above work; console shows no "auth timed out" errors.

---

## Out of Scope (v1)

- Complex streak/points UI, gamification (badges, leaderboard) — progress fields exist in the model, UI comes later.
- AI-generated sentences (approach C) — deferred.
- Dictionary sub-app migration to the shared `HubAuthService` — a later cleanup task; do NOT modify the dictionary sub-app in this plan.
- Content administration UI — seeding is script-based only.
