# Phrase Lab UI Improvement Design

> **Spec version:** 1.0
> **Date:** 2026-08-19
> **Status:** Approved

---

## Goal

Cải thiện trải nghiệm người dùng trên Phrase Lab page: thêm điều hướng Prev/Next cho Daily Session, pagination cho các tab danh sách, và nâng cấp visual card — tất cả trong khuôn khổ glassmorphism hiện tại.

---

## Architecture

- **Standalone components** (Angular 18) — không NgModule
- **Signals** cho state (RxJS BehaviorSubject chỉ dùng cho async streams)
- **OnPush change detection** — mọi component mới
- **Shared UI components** (pagination, progress-ring) tái sử dụng
- **Tailwind CSS** — utility-first, mobile-first breakpoints

---

## Tech Stack

- Angular 18 (standalone, signals, OnPush)
- Tailwind CSS (glassmorphism: `backdrop-blur-md bg-white/10 border-white/20 rounded-2xl`)
- RxJS (BehaviorSubject cho async, signals cho sync state)
- TypeScript strict mode

---

## Global Constraints

- NEVER stage `learning-english-tool-sa.json` / `firestore.rules`
- NO push without `/ship`
- Docs untracked (user tự commit)
- Strict TS `no any` (test casts as any OK)
- Commands từ `web/` directory
- Husky DEPRECATED warnings OK
- User nói tiếng Việt

---

## Component Design

### 1. Daily Session — Prev/Next Navigation

**File:** `web/src/app/sub-app/phrase-lab/components/daily-session.component.ts/html`

**State:**
```typescript
readonly index = signal(0);           // current item index
readonly sessionQueue = signal<PhraseChunk[]>([]);  // từ buildQueue()
```

**Methods:**
```typescript
prev(): void { this.index.update(i => Math.max(0, i - 1)); }
next(): void { this.index.update(i => Math.min(this.sessionQueue().length - 1, i + 1)); }
```

**Keyboard:** `HostListener('window:keydown', ['$event'])` — `ArrowLeft`/`ArrowRight` hoặc `KeyP`/`KeyN` gọi `prev()`/`next()` khi focus trong component.

**Template additions (footer card):**
```html
<div class="flex justify-between pt-4 border-t border-white/10">
  <button (click)="prev()" [disabled]="index() === 0" class="btn-glass">← Trước</button>
  <span class="text-sm text-white/60 self-center">{{ index() + 1 }} / {{ sessionQueue().length }}</span>
  <button (click)="next()" [disabled]="index() >= sessionQueue().length - 1" class="btn-glass">Tiếp →</button>
</div>
```

**CSS class `btn-glass`:** `px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed`

---

### 2. Pagination Component (Shared, Reusable)

**File:** `web/src/app/shared/ui/pagination.component.ts` (NEW)

**Inputs:**
```typescript
@Input() totalItems = 0;
@Input() pageSize = 20;
@Input() pageSizeOptions = [10, 20, 50];
```

**Signals:**
```typescript
readonly currentPage = signal(1);
readonly pageSizeSig = signal(20);
```

**Computed:**
```typescript
readonly totalPages = computed(() => Math.ceil(this.totalItems / this.pageSizeSig()));
readonly pages = computed(() => {
  const total = this.totalPages();
  const current = this.currentPage();
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  // 1, 2, ..., current-1, current, current+1, ..., total-1, total
  const pages = new Set([1, 2, total - 1, total, current]);
  for (let i = Math.max(3, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.add(i);
  return Array.from(pages).sort((a, b) => a - b);
});
```

**Methods:**
```typescript
goTo(page: number): void { this.currentPage.set(Math.max(1, Math.min(page, this.totalPages()))); }
prev(): void { this.goTo(this.currentPage() - 1); }
next(): void { this.goTo(this.currentPage() + 1); }
first(): void { this.goTo(1); }
last(): void { this.goTo(this.totalPages()); }
onPageSizeChange(size: number): void { this.pageSizeSig.set(size); this.currentPage.set(1); }
```

**Output:** `pageChange = output<{ page: number; pageSize: number }>()` — emit khi page/pageSize thay đổi.

**Template:** First | Prev | [1] [2] ... [current] ... [total-1] [total] | Next | Last + `<select>` page size.

---

### 3. Chunk Browser — Pagination Integration

**File:** `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts/html`

**Changes:**
- Inject `ChunkBrowserService` (hoặc dùng `PhraseContentService.chunks()`)
- Computed `pagedChunks = computed(() => chunks().slice((page-1)*pageSize, page*pageSize))`
- Template: render `pagedChunks()` thay vì `chunks()`
- Include `<app-pagination [totalItems]="chunks().length" (pageChange)="onPageChange($event)"></app-pagination>`
- Empty state: illustration SVG + `<button class="btn-glass" routerLink="/phrase-lab/create">Tạo chunk mới</button>`

---

### 4. Response Practice — Pagination (Scenario List)

**File:** `web/src/app/sub-app/phrase-lab/components/response-practice.component.ts/html`

**Changes:** Tương tự Chunk Browser cho danh sách scenario (nếu hiển thị list). Nếu chỉ chơi 1 scenario/lần thì không cần pagination — chỉ thêm empty state khi không có scenario.

---

### 5. Progress Ring Component (Shared, Reusable)

**File:** `web/src/app/shared/ui/progress-ring.component.ts` (NEW)

**Inputs:**
```typescript
@Input() progress = 0;        // 0-100
@Input() size = 48;           // px
@Input() strokeWidth = 4;     // px
@Input() color = 'hsl(142, 76%, 36%)';  // green default
```

**Computed:**
```typescript
readonly radius = computed(() => (this.size() - this.strokeWidth()) / 2);
readonly circumference = computed(() => 2 * Math.PI * this.radius());
readonly strokeDasharray = computed(() => `${this.circumference()} ${this.circumference()}`);
readonly strokeDashoffset = computed(() => this.circumference() * (1 - this.progress() / 100));
```

**Template:** SVG circle với `stroke-dasharray` + `stroke-dashoffset` + `transform: rotate(-90deg)`.

---

### 6. Visual Card Upgrade (Applied to all list items)

**Class:** `card-glass` — `p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200`

**Badge level:** `badge-level` — `px-2 py-0.5 rounded-full text-xs font-medium`
- A1: `bg-green-500/20 text-green-400`
- A2: `bg-blue-500/20 text-blue-400`
- B1: `bg-purple-500/20 text-purple-400`
- B2: `bg-pink-500/20 text-pink-400`
- C1: `bg-orange-500/20 text-orange-400`
- C2: `bg-red-500/20 text-red-400`

**Progress ring:** `<app-progress-ring [progress]="coverage()" size="40"></app-progress-ring>` góc trên phải card.

---

### 7. Phrase Lab Page — Tab Indicator Animation

**File:** `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.ts/html`

**CSS:**
```css
.tab-btn { @apply relative px-4 py-2 text-white/70 hover:text-white transition-colors; }
.tab-btn::after { content: ''; @apply absolute bottom-0 left-0 h-0.5 bg-emerald-400 origin-left transition-transform duration-300; transform: scaleX(0); }
.tab-btn.active::after { transform: scaleX(1); }
.tab-btn.active { @apply text-white; }
```

**Mobile:** Tab container `overflow-x-auto scrollbar-hide flex gap-2 pb-2`.

---

## Data Flow

```
Daily Session:
  User clicks Prev/Next → index signal updates → current chunk computed → UI re-renders (OnPush)

Pagination:
  User clicks page → PaginationComponent emits pageChange → Parent updates page signal → pagedItems computed slices array → UI re-renders

Progress Ring:
  Coverage % input → stroke-dashoffset computed → SVG animates (CSS transition)
```

---

## Error Handling

- Prev/Next: disabled khi ở đầu/cuối (không throw)
- Pagination: clamp page 1..totalPages, pageSize change reset về page 1
- Empty state: hiển thị illustration + CTA thay vì list rỗng
- Keyboard: chỉ handle khi component focused (tránh conflict global shortcuts)

---

## Testing

### Unit Tests
- `daily-session.component.spec.ts`: `prev()`/`next()` bounds, keyboard events, index signal sync
- `pagination.component.spec.ts`: totalPages computed, pages array (edge cases: 1, 2, 7, 10+ pages), pageChange emit
- `chunk-browser.component.spec.ts`: pagedChunks slice logic, pagination integration
- `progress-ring.component.spec.ts`: strokeDashoffset formula (0%, 50%, 100%)

### E2E (Playwright)
- Daily Session: load → click Next → verify chunk changes → click Prev → verify back
- Chunk Browser: load → verify page 1 items → click page 2 → verify different items → change pageSize → verify reset page 1

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `web/src/app/sub-app/phrase-lab/components/daily-session.component.ts` | Modify: +index, prev/next, keyboard |
| `web/src/app/sub-app/phrase-lab/components/daily-session.component.html` | Modify: +Prev/Next footer |
| `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.ts` | Modify: +pagination integration |
| `web/src/app/sub-app/phrase-lab/components/chunk-browser.component.html` | Modify: +pagination + empty state |
| `web/src/app/sub-app/phrase-lab/components/response-practice.component.ts` | Modify: +empty state (pagination nếu cần) |
| `web/src/app/sub-app/phrase-lab/components/response-practice.component.html` | Modify: +empty state |
| `web/src/app/shared/ui/pagination.component.ts` | **Create** standalone component |
| `web/src/app/shared/ui/pagination.component.html` | **Create** template |
| `web/src/app/shared/ui/pagination.component.spec.ts` | **Create** unit tests |
| `web/src/app/shared/ui/progress-ring.component.ts` | **Create** standalone component |
| `web/src/app/shared/ui/progress-ring.component.html` | **Create** template |
| `web/src/app/shared/ui/progress-ring.component.spec.ts` | **Create** unit tests |
| `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.html` | Modify: tab indicator CSS |
| `web/src/app/sub-app/phrase-lab/pages/phrase-lab-page.component.css` | Modify: +tab-btn styles |

---

## Out of Scope

- Infinite scroll (user chọn pagination)
- Drag-drop / bulk actions
- Neumorphism / minimal flat visual
- Sidebar / bottom nav (giữ 4 tab top)
- Progress Dashboard tab mới
- Server-side rendering changes

---

## Acceptance Criteria

- [ ] Daily Session: Prev/Next buttons hoạt động, keyboard ←/→ điều hướng, counter hiển thị đúng
- [ ] Chunk Browser: pagination controls hiển thị, chuyển trang đúng dữ liệu, page size select hoạt động
- [ ] Response Practice: empty state hiển thị khi không có scenario
- [ ] Pagination component: reusable, unit test pass, edge cases handled
- [ ] Progress Ring component: reusable, visual đúng % input
- [ ] Visual: glassmorphism nhất quán, badge level màu đúng, card hover effect
- [ ] Tab indicator: animated underline hoạt động, mobile scrollable
- [ ] All unit tests pass (`ng test --watch=false`)
- [ ] TypeScript compile clean (`tsc --noEmit`)
- [ ] Build production success (`npm run build`)