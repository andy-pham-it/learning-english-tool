# Phrase Lab UI Improvement Implementation Plan (v2 — reality-matched)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Improve Phrase Lab UI: Prev/Next navigation for Daily Session, pagination for the Khám phá list, visual card upgrade, and an animated tab indicator — while preserving the app's existing light-slate glassmorphism theme.

**Architecture:** Incremental, TDD, standalone Angular 18 components with signals + OnPush. Each feature: write failing test → verify fail → implement → verify pass → commit.

**Reality notes (validated against source, supersede any spec mismatch):**
- ALL phrase-lab components use **inline templates** — there are NO separate `.html`/`.css` files for daily-session, chunk-browser, response-practice, phrase-lab-page, or chunk-card. The spec's `.ts + .html` file table is wrong; edits are inline-template edits to the `.ts` file.
- App theme is **light slate**: page `bg-gradient-to-b from-slate-50 to-slate-100`; glass cards `rounded-2xl bg-white/70 backdrop-blur p-4 shadow-sm border border-slate-200`; text `text-slate-800`. The spec's dark classes (`btn-glass`, `text-white`, `bg-white/5`, `text-green-400`) do NOT exist here — use light variants.
- There is **no `/phrase-lab/create` route** — any CTA targeting it is a dead link and must be dropped.
- `web/src/app/shared/ui/` does not exist yet — Task 1 & 2 create it.
- Commands run from `web/`. Test command: `npx ng test --include='**/*.spec.ts' --watch=false` (Karma).

## Global Constraints
- NEVER stage `learning-english-tool-sa.json` / `firestore.rules`
- NO push without /ship; docs untracked (user commits docs)
- Strict TS (no `any`; `as any` allowed only in test stubs)
- Husky DEPRECATED warnings are OK

---

### Task 1: Create Pagination Component (`shared/ui`)

**Files:** create `web/src/app/shared/ui/pagination.component.ts` + `pagination.component.spec.ts` (inline template — no html file).

**API:** inputs `totalItems` (number, default 0), `pageSize` (number, default 20), `pageSizeOptions` (number[], default `[10,20,50]`); output `pageChange: { page: number; pageSize: number }`. Manages its own `page`/`size` signals internally; emits `pageChange` whenever page or size changes.

- [ ] **Step 1: Failing test** — `pagination.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let component: PaginationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();
    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('totalItems', 50);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.detectChanges();
  });

  it('creates', () => expect(component).toBeTruthy());

  it('computes totalPages = ceil(total/pageSize)', () => {
    expect(component.totalPages()).toBe(5);
    fixture.componentRef.setInput('totalItems', 51);
    fixture.detectChanges();
    expect(component.totalPages()).toBe(6);
  });

  it('emits pageChange with {page,pageSize} on next()', () => {
    const spy = jasmine.createSpy('pageChange');
    component.pageChange.subscribe(spy);
    component.next();
    expect(spy).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it('clamps at first/last page', () => {
    component.goToPage(0);
    expect(component.page()).toBe(1);
    component.goToPage(99);
    expect(component.page()).toBe(5);
  });

  it('resets to page 1 and emits when size changes', () => {
    component.goToPage(3);
    const spy = jasmine.createSpy('pageChange');
    component.pageChange.subscribe(spy);
    component.onSizeChange(50);
    expect(component.page()).toBe(1);
    expect(spy).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
  });

  it('renders a prev button disabled on page 1', () => {
    const prev = fixture.debugElement.query(By.css('[data-test="prev"]'));
    expect(prev.nativeElement.disabled).toBeTrue();
  });
});
```

- [ ] **Step 2: Verify fail** — `npx ng test --include='**/pagination.component.spec.ts' --watch=false` → FAIL (module not found / unknown property).

- [ ] **Step 3: Implement** — `pagination.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

export interface PageChangeEvent { page: number; pageSize: number; }

@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <button data-test="first" (click)="first()" [disabled]="page() === 1"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">«</button>
      <button data-test="prev" (click)="prev()" [disabled]="page() === 1"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">‹</button>
      @for (p of visiblePages(); track p) {
        @if (p === '…') {
          <span class="px-1 text-slate-400">…</span>
        } @else {
          <button (click)="goToPage(p)"
            [class]="p === page()
              ? 'rounded-lg bg-slate-800 px-2.5 py-1.5 font-semibold text-white'
              : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50'">{{ p }}</button>
        }
      }
      <button data-test="next" (click)="next()" [disabled]="page() >= totalPages()"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">›</button>
      <button data-test="last" (click)="last()" [disabled]="page() >= totalPages()"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">»</button>
      <span class="text-slate-400">{{ from() }}–{{ to() }} / {{ totalItems() }}</span>
      <select #sizeSelect (change)="onSizeChange(+sizeSelect.value)" [value]="size()"
        class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        @for (s of pageSizeOptions(); track s) { <option [value]="s">{{ s }} / trang</option> }
      </select>
    </div>
  `,
})
export class PaginationComponent {
  readonly totalItems = input(0);
  readonly pageSize = input(20);
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);
  readonly pageChange = output<PageChangeEvent>();

  readonly page = signal(1);
  readonly size = signal(20);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.size())));
  readonly from = computed(() => (this.totalItems() === 0 ? 0 : (this.page() - 1) * this.size() + 1));
  readonly to = computed(() => Math.min(this.page() * this.size(), this.totalItems()));

  readonly visiblePages = computed<Array<number | '…'>>(() => {
    const t = this.totalPages();
    const c = this.page();
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set<number>([1, 2, t - 1, t, c]);
    for (let i = Math.max(3, c - 1); i <= Math.min(t - 2, c + 1); i++) set.add(i);
    const sorted = Array.from(set).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  });

  constructor() {
    effect(() => { this.size.set(this.pageSize()); this.page.set(1); });
  }

  goToPage(p: number): void {
    const next = Math.max(1, Math.min(p, this.totalPages()));
    if (next === this.page()) return;
    this.page.set(next);
    this.pageChange.emit({ page: next, pageSize: this.size() });
  }
  first(): void { this.goToPage(1); }
  last(): void { this.goToPage(this.totalPages()); }
  prev(): void { this.goToPage(this.page() - 1); }
  next(): void { this.goToPage(this.page() + 1); }
  onSizeChange(s: number): void {
    this.size.set(s);
    this.page.set(1);
    this.pageChange.emit({ page: 1, pageSize: s });
  }
}
```

- [ ] **Step 4: Verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git add web/src/app/shared/ui/ && git commit -m "feat(shared): add reusable pagination component (light slate theme)"`

---

### Task 2: Create Progress Ring Component (`shared/ui`)

**Files:** create `web/src/app/shared/ui/progress-ring.component.ts` + `progress-ring.component.spec.ts`.

**API:** inputs `progress` (0–100, default 0), `size` (default 48), `strokeWidth` (default 4), `color` (default `#047857` emerald-700), `trackColor` (default `#e2e8f0` slate-200). Pure visual.

- [ ] **Step 1: Failing test** — `progress-ring.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  let fixture: ComponentFixture<ProgressRingComponent>;
  let component: ProgressRingComponent;

  const offsetAttr = () =>
    fixture.debugElement.query(By.css('circle:last-of-type'))
      .nativeElement.getAttribute('stroke-dashoffset');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProgressRingComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProgressRingComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('size', 48);
    fixture.componentRef.setInput('strokeWidth', 4);
    fixture.detectChanges();
  });

  const C = 2 * Math.PI * 22; // radius = (48-4)/2 = 22

  it('creates', () => expect(component).toBeTruthy());

  it('dashoffset = full circumference at 0%', () => {
    expect(component.dashOffset()).toBeCloseTo(C, 1);
  });

  it('dashoffset = half circumference at 50%', () => {
    fixture.componentRef.setInput('progress', 50);
    fixture.detectChanges();
    expect(component.dashOffset()).toBeCloseTo(C / 2, 1);
  });

  it('dashoffset = 0 at 100%', () => {
    fixture.componentRef.setInput('progress', 100);
    fixture.detectChanges();
    expect(component.dashOffset()).toBeCloseTo(0, 1);
  });

  it('clamps progress outside 0..100', () => {
    fixture.componentRef.setInput('progress', 150);
    fixture.detectChanges();
    expect(component.dashOffset()).toBeCloseTo(0, 1);
  });

  it('applies dashoffset to the SVG circle', () => {
    fixture.componentRef.setInput('progress', 50);
    fixture.detectChanges();
    expect(+offsetAttr()!).toBeCloseTo(C / 2, 1);
  });
});
```

- [ ] **Step 2: Verify fail** → module not found.

- [ ] **Step 3: Implement** — `progress-ring.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" [attr.viewBox]="'0 0 ' + size() + ' ' + size()" class="block">
      <circle [attr.cx]="size()/2" [attr.cy]="size()/2" [attr.r]="radius()" fill="none"
        [attr.stroke]="trackColor()" [attr.stroke-width]="strokeWidth()"/>
      <circle [attr.cx]="size()/2" [attr.cy]="size()/2" [attr.r]="radius()" fill="none"
        [attr.stroke]="color()" [attr.stroke-width]="strokeWidth()" stroke-linecap="round"
        [attr.stroke-dasharray]="circumference() + ' ' + circumference()"
        [attr.stroke-dashoffset]="dashOffset()"
        [attr.transform]="'rotate(-90 ' + size()/2 + ' ' + size()/2 + ')'"
        class="transition-[stroke-dashoffset] duration-300 ease-in-out"/>
    </svg>
  `,
})
export class ProgressRingComponent {
  readonly progress = input(0);
  readonly size = input(48);
  readonly strokeWidth = input(4);
  readonly color = input('#047857');
  readonly trackColor = input('#e2e8f0');

  readonly radius = computed(() => (this.size() - this.strokeWidth()) / 2);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  readonly dashOffset = computed(() =>
    this.circumference() * (1 - Math.min(100, Math.max(0, this.progress())) / 100));
}
```

- [ ] **Step 4: Verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `git add web/src/app/shared/ui/progress-ring.component.ts web/src/app/shared/ui/progress-ring.component.spec.ts && git commit -m "feat(shared): add reusable progress ring component"`

---

### Task 3: Daily Session Prev/Next + Keyboard Navigation

**File:** modify `web/src/app/sub-app/phrase-lab/components/daily-session.component.ts` (inline template) + extend `daily-session.component.spec.ts`.

**Context:** component already tracks `sessionQueue`, `index`, `current`, `done`, `showVi`; constructor `effect()` builds queue once when `content.chunks()` becomes non-empty. Only edits: add nav methods, a window-keyboard `HostListener`, and a footer nav row in the template.

- [ ] **Step 1: Failing tests** — append to existing `daily-session.component.spec.ts` (reuse its harness: `chunks` signal, `progressStub` = `jasmine.createSpyObj('PhraseProgressService',['getDueChunks','getCoverage','reviewChunk'])` + `progressStub.progress = signal(null)`, `speechStub`, `rebuild()` helper, `chunk()` factory). Note: `PhraseProgressService` is **async** — `reviewChunk` returns a Promise; `getDueChunks`/`getCoverage` are sync.

```typescript
describe('nav', () => {
  it('moves to next chunk and clamps at the end', async () => {
    chunks.set([chunk('a'), chunk('b'), chunk('c')]);
    await rebuild();
    expect(component.index()).toBe(0);
    component.next();
    expect(component.index()).toBe(1);
    component.next(); component.next(); component.next();
    expect(component.index()).toBe(2);
  });

  it('moves to previous chunk and clamps at the start', async () => {
    chunks.set([chunk('a'), chunk('b')]);
    await rebuild();
    component.next();
    expect(component.index()).toBe(1);
    component.prev(); component.prev();
    expect(component.index()).toBe(0);
  });

  it('does not navigate when queue is empty', async () => {
    await rebuild();
    component.next(); component.prev();
    expect(component.index()).toBe(0);
  });

  it('responds to ArrowRight / ArrowLeft keydown', async () => {
    chunks.set([chunk('a'), chunk('b')]);
    await rebuild();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.index()).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.index()).toBe(0);
  });

  it('renders a prev button disabled on the first item', async () => {
    chunks.set([chunk('a'), chunk('b')]);
    await rebuild();
    const prev = fixture.debugElement.query(By.css('[data-test="session-prev"]'));
    expect(prev.nativeElement.disabled).toBeTrue();
    component.next();
    fixture.detectChanges();
    expect(prev.nativeElement.disabled).toBeFalse();
  });
});
```
(Add `import { By } from '@angular/platform-browser';` at top of the spec if not present.)

- [ ] **Step 2: Verify fail** — `npx ng test --include='**/daily-session.component.spec.ts' --watch=false` → new tests FAIL (methods/selectors missing).

- [ ] **Step 3: Implement** — in `daily-session.component.ts`:
- Add `@HostListener('window:keydown', ['$event']) onKeydown(e: KeyboardEvent)` handling only when `!done()` and `current()`; `ArrowRight` → `next()`, `ArrowLeft` → `prev()` (and ignore if queue empty). Add `import { HostListener } from '@angular/core';`.
- Add methods:
  ```typescript
  prev(): void { if (this.index() > 0) { this.index.update(i => i - 1); this.showVi.set(false); } }
  next(): void { if (this.index() < this.sessionQueue().length - 1) { this.index.update(i => i + 1); this.showVi.set(false); } }
  ```
- In the inline template, inside the existing `@if (!done() && current())` block, after the rating grid add a footer nav row:
  ```html
  <div class="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
    <button data-test="session-prev" (click)="prev()" [disabled]="index() === 0"
      class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">← Trước</button>
    <span class="text-sm font-medium text-slate-500">{{ index() + 1 }} / {{ sessionQueue().length }}</span>
    <button data-test="session-next" (click)="next()" [disabled]="index() >= sessionQueue().length - 1"
      class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Tiếp →</button>
  </div>
  ```
  Keep the existing header progress badge (`{{ index() + 1 }}/{{ sessionQueue().length }}`) as-is.

- [ ] **Step 4: Verify pass** — same command → all PASS (existing + new).
- [ ] **Step 5: Commit** — `git add web/src/app/sub-app/phrase-lab/components/daily-session.component.ts web/src/app/sub-app/phrase-lab/components/daily-session.component.spec.ts && git commit -m "feat(phrase-lab): add prev/next + keyboard nav to daily session"`

---

### Task 4: Paginate the Khám phá List (Chunk Browser)

**File:** modify `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts` (inline template, imports `[FormsModule, ChunkCardComponent]`) + extend `chunk-browser.component.spec.ts`.

**Context:** has 3 filter `<select>`s (ngModel) bound to `domains/contexts/levels`, `filtered` computed, grid of `<app-chunk-card [chunk]="chunk" />`, count paragraph. No pagination/empty state today. **CRITICAL TEST NOTE:** once cards render, `ChunkCardComponent` injects `PhraseProgressService` + `SpeechService` — the spec must provide stubs (root DI won't resolve them in Karma).

- [ ] **Step 1: Failing tests** — extend `chunk-browser.component.spec.ts`. Existing provider is minimal; add the missing service stubs so 20+ cards can render:

```typescript
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PaginationComponent } from '../../../shared/ui/pagination.component';

const progressStub = jasmine.createSpyObj('PhraseProgressService',
  ['getDueChunks', 'getCoverage', 'reviewChunk', 'markChunkLearned', 'recordSpeakResult']);
progressStub.progress = signal(null);

const speechStub = { speak: jasmine.createSpy('speak'), startListening: jasmine.createSpy('startListening'), isRecognitionSupported: () => false };

const makeChunks = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `c${i}`, domain: 'it', context: 'meeting', level: 'B2',
  english: `Word ${i}`, vietnamese: `Từ ${i}`, phonetic: '/wɜːrd/',
  role: 'opener', usage: 'Ví dụ', examples: [],
}));

describe('chunk browser pagination', () => {
  let fixture: ComponentFixture<ChunkBrowserComponent>;
  let component: ChunkBrowserComponent;
  let chunks: ReturnType<typeof signal<any[]>>;

  beforeEach(async () => {
    chunks = signal(makeChunks(25));
    await TestBed.configureTestingModule({
      imports: [ChunkBrowserComponent],
      providers: [
        { provide: PhraseContentService, useValue: { chunks, domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']), loadAll: jasmine.createSpy('loadAll'), offline: signal(false) } },
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: SpeechService, useValue: speechStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChunkBrowserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders only the first page (20 of 25) cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-chunk-card');
    expect(cards.length).toBe(20);
  });

  it('shows the pagination control when there is more than one page', () => {
    expect(fixture.debugElement.query(By.directive(PaginationComponent))).toBeTruthy();
  });

  it('goes to page 2 via the pagination component and shows 5 cards', () => {
    const pg = fixture.debugElement.query(By.directive(PaginationComponent)).componentInstance as PaginationComponent;
    pg.goToPage(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-chunk-card').length).toBe(5);
  });

  it('resets to page 1 when a filter changes', () => {
    const pg = fixture.debugElement.query(By.directive(PaginationComponent)).componentInstance as PaginationComponent;
    pg.goToPage(2);
    component.selectDomain('all');
    fixture.detectChanges();
    expect(component.page()).toBe(1);
  });

  it('shows an empty state when no chunks match filters', () => {
    chunks.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chưa có từ vựng');
  });
});
```
(Adjust imports/paths to the real `SpeechService` location — `src/app/core/...` — check the existing daily-session spec import.) Keep the original minimal spec's existing `creates the component` test.

- [ ] **Step 2: Verify fail** → new tests FAIL (unknown props/methods).

- [ ] **Step 3: Implement** — in `chunk-browser.component.ts`:
- Add `PaginationComponent` to `imports`.
- Add signals `page = signal(1)`, `pageSize = signal(20)` and computed `pagedChunks = computed(() => { const f = this.filtered(); return f.slice((this.page()-1)*this.pageSize(), this.page()*this.pageSize()); })`.
- Add `onPageChange(e: PageChangeEvent): void { this.page.set(e.page); this.pageSize.set(e.pageSize); }` (import `PageChangeEvent` from `../../../shared/ui/pagination.component`).
- Reset page on filter change: in `selectDomain()` and the `(ngModelChange)` handlers of the context/level selects, call `this.page.set(1)`.
- Template edits:
  - Grid loop: `@for (chunk of pagedChunks(); track chunk.id)` (was `filtered()`).
  - Empty state above the grid: `@if (filtered().length === 0) { <div class="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-slate-500">Chưa có từ vựng nào phù hợp bộ lọc.</div> }`.
  - Below the grid: `@if (filtered().length > pageSize()) { <app-pagination [totalItems]="filtered().length" [pageSize]="pageSize()" (pageChange)="onPageChange($event)" /> }`.

- [ ] **Step 4: Verify pass** → same command → all PASS.
- [ ] **Step 5: Commit** — `git add web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts web/src/app/sub-app/phrase-lab/components/chunk-browser.component.spec.ts && git commit -m "feat(phrase-lab): paginate chunk browser list + empty state"`

---

### Task 5: Response Practice Empty State

**File:** modify `web/src/app/sub-app/phrase-lab/components/response-practice.component.ts` (inline template) + create `response-practice.component.spec.ts` (no spec exists today).

**Context:** component exposes `scenariosSvc = inject(ScenarioService)` (signals `scenarios/loading/offline`); `start` phase is a landing card (title, desc, level pills, Bắt đầu). There is no scenario list → **no pagination**. Add an empty state when zero scenarios exist and not loading. There is no `/phrase-lab/create` route, so the CTA must NOT be a routerLink — use informational text + a hint.

- [ ] **Step 1: Failing test** — `response-practice.component.spec.ts` (mirror the daily-session harness; `ScenarioService` stub is `{ scenarios, loading: signal(false), offline: signal(false), loadScenarios: spy }`; `PhraseContentService` stub `{ chunks: signal([]), templates: signal([]), loadAll: spy, offline: signal(false) }`; `PhraseProgressService` + `SpeechService` stubs as in Task 4; a `Scenario` stub factory `makeScenario()` returning `{ id: 's1', level: 'A2', context: 'meeting', title: 'T', turns: [{ speakerLine: 'Hi', answers: [{ ids: ['a'] }], replyLine: 'Hello' }] }`):

```typescript
describe('response practice empty state', () => {
  let fixture: ComponentFixture<ResponsePracticeComponent>;
  let component: ResponsePracticeComponent;
  let scenarios: ReturnType<typeof signal<any[]>>;

  beforeEach(async () => {
    scenarios = signal([]);
    await TestBed.configureTestingModule({
      imports: [ResponsePracticeComponent],
      providers: [
        { provide: ScenarioService, useValue: { scenarios, loading: signal(false), offline: signal(false), loadScenarios: jasmine.createSpy('loadScenarios') } },
        { provide: PhraseContentService, useValue: { chunks: signal([]), templates: signal([]), loadAll: jasmine.createSpy('loadAll'), offline: signal(false) } },
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: SpeechService, useValue: speechStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ResponsePracticeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the empty state when no scenarios exist', () => {
    expect(fixture.nativeElement.textContent).toContain('Chưa có kịch bản');
  });

  it('hides the empty state when scenarios exist', () => {
    scenarios.set([makeScenario()]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Chưa có kịch bản');
  });

  it('hides the empty state while loading', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Chưa có kịch bản');
  });
});
```

- [ ] **Step 2: Verify fail** → new spec FAILS (module not found).

- [ ] **Step 3: Implement** — in `response-practice.component.ts` inline template, inside the `start` phase block, add before the level pills:
```html
@if (scenariosSvc.scenarios().length === 0 && !scenariosSvc.loading() && !scenariosSvc.offline()) {
  <div class="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
    <p class="text-slate-600">Chưa có kịch bản nào để luyện tập phản xạ.</p>
    <p class="mt-1 text-sm text-slate-400">Hãy ghé tab Khám phá để học thêm cụm từ — kịch bản sẽ xuất hiện ở đây sau khi có nội dung.</p>
  </div>
}
@if (scenariosSvc.loading()) {
  <p class="text-sm text-slate-400">Đang tải kịch bản…</p>
}
```
No `.ts` logic change required if `scenariosSvc` is already public (it is).

- [ ] **Step 4: Verify pass** → same command → PASS.
- [ ] **Step 5: Commit** — `git add web/src/app/sub-app/phrase-lab/components/response-practice.component.ts web/src/app/sub-app/phrase-lab/components/response-practice.component.spec.ts && git commit -m "feat(phrase-lab): add empty state to response practice start screen"`

---

### Task 6: Chunk Card Visual Upgrade (level badge + hover + progress ring)

**File:** modify `web/src/app/sub-app/phrase-lab/components/chunk-card.component.ts` (inline template, add `ProgressRingComponent` to imports) + create `chunk-card.component.spec.ts` (none exists).

**Context:** card already shows a role badge (colored via `ROLE_COLOR`), english/phonetic, speak button, vietnamese, usage box, examples, 'Đã học' button; computed `mastered = !!progress.progress()?.masteredChunks[id]`. `PhraseProgressService` shape: `progress()` → `{ masteredChunks: {[id]: {status, speakScore, lastPracticed}}, reviews: {[id]: {ease,...}}, ... }`; `markChunkLearned(id)` async; `reviewChunk(id, rating)` async. **Adapted from spec §6 dark classes → light slate.**

- [ ] **Step 1: Failing tests** — `chunk-card.component.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ChunkCardComponent } from './chunk-card.component';
import { ProgressRingComponent } from '../../../shared/ui/progress-ring.component';

const progressStub = jasmine.createSpyObj('PhraseProgressService',
  ['getDueChunks', 'getCoverage', 'reviewChunk', 'markChunkLearned', 'recordSpeakResult']);
const speechStub = { speak: jasmine.createSpy('speak'), startListening: jasmine.createSpy('startListening'), isRecognitionSupported: () => false };

const makeChunk = (over: Partial<any> = {}) => ({
  id: 'c1', domain: 'it', context: 'meeting', level: 'B2',
  english: 'Let me get back to you', vietnamese: 'Để tôi liên hệ lại bạn sau',
  phonetic: '/lɛt miː gɛt bæk tə juː/', role: 'closer', usage: 'Dùng khi kết thúc cuộc họp', examples: [],
  ...over,
});

describe('ChunkCardComponent', () => {
  let fixture: ComponentFixture<ChunkCardComponent>;
  let component: ChunkCardComponent;

  beforeEach(async () => {
    progressStub.progress = signal(null);
    await TestBed.configureTestingModule({
      imports: [ChunkCardComponent],
      providers: [
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: SpeechService, useValue: speechStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChunkCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('chunk', makeChunk());
    fixture.detectChanges();
  });

  it('creates', () => expect(component).toBeTruthy());

  it('renders the level badge with the chunk level', () => {
    const badge = fixture.debugElement.query(By.css('[data-test="level-badge"]'));
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('B2');
  });

  it('shows 0% ring when not reviewed', () => {
    expect(component.cardProgress()).toBe(0);
    expect(fixture.debugElement.query(By.directive(ProgressRingComponent))).toBeTruthy();
  });

  it('shows 100% ring when mastered', () => {
    progressStub.progress.set({ masteredChunks: { c1: { status: 'mastered', speakScore: 90, lastPracticed: Date.now() } }, reviews: {}, streak: { current: 0, lastDay: '' }, totalPoints: 0 });
    fixture.detectChanges();
    expect(component.cardProgress()).toBe(100);
  });
});
```

- [ ] **Step 2: Verify fail** → module/import errors + missing `cardProgress`.

- [ ] **Step 3: Implement** — in `chunk-card.component.ts`:
- Add `import { ProgressRingComponent } from '../../../shared/ui/progress-ring.component';` and add it to `imports`.
- Add a `LEVEL_COLOR` map (light theme) mirroring `ROLE_COLOR` style: `{ A1: 'bg-emerald-100 text-emerald-700', A2: 'bg-sky-100 text-sky-700', B1: 'bg-violet-100 text-violet-700', B2: 'bg-amber-100 text-amber-700', C1: 'bg-orange-100 text-orange-700', C2: 'bg-rose-100 text-rose-700' }`.
- Add computed `cardProgress = computed(() => { const p = this.progress.progress(); if (!p) return 0; if (p.masteredChunks[this.chunk().id]?.status === 'mastered') return 100; if (p.reviews[this.chunk().id]) return 50; return 0; })`.
- Template edits:
  - Top row: add level badge next to the role badge: `<span data-test="level-badge" [class]="'text-xs font-medium px-2 py-0.5 rounded-full ' + levelColor()">{{ chunk().level }}</span>` with `levelColor = computed(() => LEVEL_COLOR[this.chunk().level] ?? LEVEL_COLOR.A1)`.
  - Card: add hover + transition: `class="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-sm border border-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"`.
  - Add the progress ring beside the 'Đã học' button row: `<app-progress-ring [progress]="cardProgress()" [size]="20" [strokeWidth]="3" />` with `title="Mức độ thành thạo"`.

- [ ] **Step 4: Verify pass** → same command → PASS.
- [ ] **Step 5: Commit** — `git add web/src/app/sub-app/phrase-lab/components/chunk-card.component.ts web/src/app/sub-app/phrase-lab/components/chunk-card.component.spec.ts && git commit -m "feat(phrase-lab): chunk card level badge + hover + mastery ring"`

---

### Task 7: Animated Tab Indicator (Phrase Lab page)

**File:** modify `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts` (inline template). No component CSS file — the indicator must be pure Tailwind (arbitrary properties OK), matching the app's Tailwind-only convention. **Adapted from spec §7 `.tab-btn::after` → Tailwind underline span.**

**Context:** 10-tab bar currently `flex flex-wrap gap-2 text-sm`, pill buttons `rounded-xl px-3 py-1.5 font-medium transition`, active `bg-slate-800 text-white`, inactive `bg-white text-slate-600`. `activeTab` signal. On mobile it wraps — change to horizontal scroll (nowrap) on small screens, wrap on ≥sm.

- [ ] **Step 1: Failing tests** — create `phrase-lab-page.component.spec.ts` (none exists). The page hosts many tab sections that inject services — provide the full stub set (PhraseContentService, PhraseProgressService, ScenarioService, SpeechService) as in Tasks 4–5. Keep the test to tab-bar behavior only:

```typescript
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PhraseLabPageComponent } from './phrase-lab-page.component';

const progressStub = jasmine.createSpyObj('PhraseProgressService',
  ['getDueChunks', 'getCoverage', 'reviewChunk', 'markChunkLearned', 'recordSpeakResult']);
progressStub.progress = signal(null);
const speechStub = { speak: jasmine.createSpy('speak'), startListening: jasmine.createSpy('startListening'), isRecognitionSupported: () => false };

describe('PhraseLabPageComponent tabs', () => {
  let fixture: ComponentFixture<PhraseLabPageComponent>;
  let component: PhraseLabPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhraseLabPageComponent],
      providers: [
        { provide: PhraseContentService, useValue: { chunks: signal([]), templates: signal([]), domains: signal([]), contexts: signal([]), levels: signal([]), loadAll: jasmine.createSpy('loadAll'), offline: signal(false) } },
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: ScenarioService, useValue: { scenarios: signal([]), loading: signal(false), offline: signal(false), loadScenarios: jasmine.createSpy('loadScenarios') } },
        { provide: SpeechService, useValue: speechStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PhraseLabPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders all 10 tab buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('[data-test="tab-button"]');
    expect(buttons.length).toBe(10);
  });

  it('defaults activeTab to today', () => {
    expect(component.activeTab()).toBe('today');
  });

  it('moves the underline span to the clicked tab', () => {
    const buttons = fixture.nativeElement.querySelectorAll('[data-test="tab-button"]');
    buttons[3].click(); // 'analysis'
    fixture.detectChanges();
    const underline = fixture.debugElement.query(By.css('[data-test="tab-underline"]'));
    expect(underline).toBeTruthy();
    expect(component.activeTab()).toBe('analysis');
  });
});
```
(Add `data-test="tab-button"` and `data-test="tab-underline"` in the implementation template.)

- [ ] **Step 2: Verify fail** → new spec FAILS (module/selector missing).

- [ ] **Step 3: Implement** — in `phrase-lab-page.component.ts` inline template:
- Tab bar container → `class="mb-4 flex gap-2 overflow-x-auto pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"`.
- Each tab button → add `data-test="tab-button"`, `relative whitespace-nowrap`, and an underline span as the last child:
  ```html
  <button data-test="tab-button" (click)="setTab(t.id)" [class]="activeTab() === t.id ? 'relative whitespace-nowrap rounded-xl bg-slate-800 px-3 py-1.5 font-medium text-white transition' : 'relative whitespace-nowrap rounded-xl bg-white px-3 py-1.5 font-medium text-slate-600 transition hover:text-slate-800'">
    {{ t.label }}
    <span data-test="tab-underline" aria-hidden="true"
      class="absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-emerald-500 transition-transform duration-300"
      [class.scale-x-100]="activeTab() === t.id"
      [class.scale-x-0]="activeTab() !== t.id"></span>
  </button>
  ```
  (Loop over the existing `tabs` array in the template; adjust `setTab` to also call `activeTab.set(t.id)` — verify against the current implementation which may already do this.)

- [ ] **Step 4: Verify pass** → same command → PASS (all prior page smoke tests too).
- [ ] **Step 5: Commit** — `git add web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.spec.ts && git commit -m "feat(phrase-lab): animated tab indicator + mobile scroll"`

---

### Task 8: Final Verification Gates

- [ ] **Step 1:** `npx tsc --noEmit` (from `web/`) → exit 0.
- [ ] **Step 2:** `npx ng test --watch=false` → all specs pass (baseline was ~138 pass + 1 pre-existing AppComponent failure — confirm no NEW failures).
- [ ] **Step 3:** `npm run build` → exit 0.
- [ ] **Step 4:** `git status --short` → no `learning-english-tool-sa.json` / `firestore.rules` staged.
- [ ] **Step 5:** Report results; do NOT push.