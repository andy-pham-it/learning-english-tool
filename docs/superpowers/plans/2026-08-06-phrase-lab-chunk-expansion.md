# Phrase-Lab Chunk Expansion (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the phrase-lab seed from 173 chunks / 45 templates to ~845 chunks / ~97 templates, add two new roles (`reaction`, `question`), and re-validate everything.

**Architecture:** Extend the `Role` type union in the phrase model (1 line) and the badge color map (2 lines) — all role consumers are generic string comparisons so nothing else changes. Hand-write ~672 new chunks as 9 per-context blocks in `phrase-seed.data.ts` (following the existing `// ===== 8.x =====` section-marker convention, new markers `// ===== EXPANSION v2: <domain> — <context> =====`), then append 52 new templates. A dedup script + the existing validator prove no id/english collisions and full template-slot resolution.

**Tech Stack:** TypeScript (strict), Angular 18 standalone components (tests via Karma/Jasmine), tsx for scripts.

## Global Constraints

- Chunk shape (verbatim from `PhraseChunk` in `web/src/app/sub-app/phrase-lab/models/phrase.model.ts`): `{ id, domain, context, level: 'A2'|'B1'|'B2'|'C1', english, vietnamese, phonetic, role, examples: {en, vi}[] }`. Every chunk has exactly 1 example object in `examples`.
- New roles: `'reaction'` (agreement/reaction phrases) and `'question'` (proactive questions). ONLY in natural contexts: reaction → it-meet, biz-meet, day-st, day-op; question → it-meet, biz-meet, biz-neg, day-st. **it-email, biz-email, it-inc get ZERO reaction/question chunks** (natural gaps; templates for those contexts only use the 4 core roles).
- `english` values must be unique across the ENTIRE seed (existing 173 + new). No chunk may duplicate an existing or sibling chunk's `english`.
- Chunk ids: `<domain>-<context>-<level>-<nn>` continuing existing numbering per the table below. Template ids: `tpl-<dom>-<ctx>-<level>-<nn>` (`-02`, `-03` onward).
- Full phonetic for every chunk (IPA in `/.../`).
- Vietnamese translations natural and idiomatic.
- Data file: `/Users/admin/personal/learning-english-tool/web/scripts/seed-data/phrase-seed.data.ts`. All npm commands run from `web/`.
- Repo commit style: `feat(phrase-lab): <description>`. Do NOT push; the user runs `/ship`.
- Re-seed after implementation: `cd web && GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/learning-english-tool-sa.json" npx tsx scripts/seed-phrase-lab.ts` (idempotent, batch.set by id).
- Never stage `learning-english-tool-sa.json` or `web/firestore.rules` (pre-existing local modification).

---

### Task 1: Extend the Role union in the phrase model

**Files:**
- Modify: `web/src/app/sub-app/phrase-lab/models/phrase.model.ts:1`
- Create: `web/src/app/sub-app/phrase-lab/models/phrase.model.spec.ts` (new file — none exists)

**Interfaces:**
- Consumes: nothing (repo baseline).
- Produces: `Role = 'opener' | 'linker' | 'filler' | 'closer' | 'reaction' | 'question'` — every later task (chunk authoring, chunk-card colors) depends on these two new members being valid.

- [ ] **Step 1: Write the failing test**

Create `web/src/app/sub-app/phrase-lab/models/phrase.model.spec.ts`:

```typescript
import { PhraseChunk, Role } from './phrase.model';

describe('phrase model', () => {
  it('accepts the two new roles reaction and question', () => {
    const chunk: PhraseChunk = {
      id: 'x',
      domain: 'daily',
      context: 'small-talk',
      level: 'A2',
      english: 'that makes sense',
      vietnamese: 'hợp lý đấy',
      phonetic: '/ðæt meɪks sens/',
      role: 'reaction',
      examples: [{ en: 'That makes sense to me.', vi: 'Điều đó hợp lý với tôi.' }],
    };
    expect(chunk.role).toBe('reaction' as Role);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include='**/phrase.model.spec.ts'` from `web/`
Expected: FAIL — `'reaction' is not assignable to type 'Role'`.

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/app/sub-app/phrase-lab/models/phrase.model.ts` line 1:

```typescript
export type Role = 'opener' | 'linker' | 'filler' | 'closer' | 'reaction' | 'question';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false --include='**/phrase.model.spec.ts'` from `web/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/models/phrase.model.ts web/src/app/sub-app/phrase-lab/models/phrase.model.spec.ts
git commit -m "feat(phrase-lab): extend Role type with reaction and question"
```

---

### Task 2: Badge colors for the new roles in chunk-card

**Files:**
- Modify: `web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.ts:6-11` (ROLE_COLOR map)
- Create: `web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.spec.ts` (new file — none exists)

**Interfaces:**
- Consumes: `Role` from Task 1 (not required at runtime — map is `Record<string, string>`).
- Produces: badge classes `bg-rose-100 text-rose-700` for reaction, `bg-amber-100 text-amber-700` for question. Later tasks rely on these classes rendering without undefined.

- [ ] **Step 1: Write the failing test**

Create `web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChunkCardComponent } from './chunk-card.component';

describe('ChunkCardComponent', () => {
  let fixture: ComponentFixture<ChunkCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChunkCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ChunkCardComponent);
  });

  function setChunk(role: string) {
    fixture.componentRef.setInput('chunk', {
      id: 'x', domain: 'daily', context: 'small-talk', level: 'A2',
      english: 'e', vietnamese: 'v', phonetic: '/p/', role,
      examples: [{ en: 'e', vi: 'v' }],
    });
  }

  it('maps reaction to rose badge classes', () => {
    setChunk('reaction');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.className).toContain('bg-rose-100');
    expect(badge.className).toContain('text-rose-700');
  });

  it('maps question to amber badge classes', () => {
    setChunk('question');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.className).toContain('bg-amber-100');
    expect(badge.className).toContain('text-amber-700');
  });
});
```

NOTE: the badge element must carry class `badge` for the selector to work. Inspect the current template's role badge (it already applies `roleColor` via `[class]`); if the badge already has a static class like `rounded-full px-2 py-0.5 text-xs`, use that instead of adding `.badge` — the test only needs a selector that matches. Adjust `querySelector` accordingly if needed, keeping the assertion on `bg-rose-100`/`text-rose-700`/`bg-amber-100`/`text-amber-700`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include='**/chunk-card.component.spec.ts'` from `web/`
Expected: FAIL — className does not contain `bg-rose-100`.

- [ ] **Step 3: Write minimal implementation**

Edit `web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.ts`, ROLE_COLOR map (lines 6-11): add two entries after `closer`:

```typescript
reaction: 'bg-rose-100 text-rose-700',
question: 'bg-amber-100 text-amber-700',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false --include='**/chunk-card.component.spec.ts'` from `web/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.ts web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.spec.ts
git commit -m "feat(phrase-lab): badge colors for reaction and question roles"
```

---

### Task 3: Hand-write chunk block — it-meet (+88)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== EXPANSION: IT — email (A2, C1, B1/B2 filler/linker) =====` marker (end of the IT — meeting chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1) for `role` fields; existing chunk shape.
- Produces: 88 new chunks with ids `it-meet-a2-05..`, `it-meet-b1-08..`, `it-meet-b2-08..`, `it-meet-c1-05..`. Later tasks' dedup script (Task 13) requires every `english` here to be unique globally and ids non-colliding.

- [ ] **Step 1: Write the block**

Insert (marker + 88 chunk objects):

```typescript
  // ===== EXPANSION v2: IT — meeting =====
```

followed by 88 `PhraseChunk` objects in this exact order per level (levels in order A2, B1, B2, C1; within each level, roles in order opener, linker, filler, closer, reaction, question):

- A2 (ids `it-meet-a2-05` .. `it-meet-a2-20`): 4 opener, 4 linker, 4 filler, 4 closer, 3 reaction, 3 question
- B1 (ids `it-meet-b1-08` .. `it-meet-b1-23`): same 4/4/4/4/3/3 split
- B2 (ids `it-meet-b2-08` .. `it-meet-b2-23`): same split
- C1 (ids `it-meet-c1-05` .. `it-meet-c1-20`): same split

Content direction — meeting role phrases (tech team syncs, stand-ups):
- opener: kickoffs ("to kick off the stand-up", "to run through the agenda", "shall we get the ball rolling")
- linker: transitions ("to move on to the next point", "to pick up where we left off", "to walk through")
- filler: hedging/softening ("for what it's worth", "to be perfectly honest", "if you ask me")
- closer: wrap-ups ("to wrap the meeting up", "to summarize the action items", "to close the loop")
- reaction (NEW): ("that makes sense", "fair enough", "sounds good to me", "I am on board")
- question (NEW): ("what is the status of", "how do we handle", "who owns the next step")

Each object: full `{id, domain:'it', context:'meeting', level, english, vietnamese, phonetic, role, examples:[{en,vi}]}`. All english distinct from every existing chunk and from each other; natural examples. No reaction/question for B1/B2 filler gap concerns — all roles present.

- [ ] **Step 2: Verify block integrity**

Run: `npx tsx /tmp/seedcheck/validate.mts` from `web/` (after re-copying `phrase-seed.data.ts` to `/tmp/seedcheck/` and sed-fixing the import `'../../src/app/sub-app/phrase-lab/models/phrase.model'` → `'./phrase.model'`).
Expected: no new GAPs reported for it/meeting; chunk count for it/meeting increases by 88.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +88 it-meet chunks incl reaction/question roles"
```

---

### Task 4: Hand-write chunk block — it-email (+64)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== 8.4 Business — meeting =====` marker (end of the IT — email chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 64 new chunks `it-email-a2-05..`, `it-email-b1-07..`, `it-email-b2-07..`, `it-email-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: IT — email =====` + 64 chunk objects. Levels A2/B1/B2/C1; per level 4 opener + 4 linker + 4 filler + 4 closer (NO reaction, NO question — natural gap). A2 ids `it-email-a2-05..20`, B1 `it-email-b1-07..22`, B2 `it-email-b2-07..22`, C1 `it-email-c1-05..20`.

Content direction — email role phrases (tickets, status updates, follow-ups):
- opener: ("I wanted to touch base", "I am writing to update you on", "just a heads-up")
- linker: ("as per our last conversation", "regarding the attached", "in the meantime")
- filler: ("as far as I understand", "for your information", "to be on the safe side")
- closer: ("looking forward to your reply", "let me know if anything is unclear", "best regards for now")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed as in Task 3).
Expected: no new GAPs for it/email; count +64.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +64 it-email chunks"
```

---

### Task 5: Hand-write chunk block — it-inc (+64)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== EXPANSION: IT — meeting (A2, C1, B1/B2 filler/linker) =====` marker (end of the IT — incident chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 64 new chunks `it-inc-a2-05..`, `it-inc-b1-05..`, `it-inc-b2-08..`, `it-inc-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: IT — incident =====` + 64 chunk objects. Per level 4/4/4/4 (opener/linker/filler/closer), NO reaction/question. A2 ids `it-inc-a2-05..20`, B1 `it-inc-b1-05..20`, B2 `it-inc-b2-08..23`, C1 `it-inc-c1-05..20`.

Content direction — incident role phrases (outages, bug reports, RCAs):
- opener: ("we are experiencing an outage", "there has been a critical incident", "I need to escalate")
- linker: ("on further inspection", "in the meantime", "once we isolate the root cause")
- filler: ("at this juncture", "to the best of our knowledge", "as we speak")
- closer: ("we will keep you posted", "to prevent recurrence", "we have restored the service")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for it/incident; count +64.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +64 it-incident chunks"
```

---

### Task 6: Hand-write chunk block — biz-meet (+88)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== EXPANSION: Business — email (A2, C1, B1/B2 filler/linker) =====` marker (end of the Business — meeting chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 88 new chunks `biz-meet-a2-05..`, `biz-meet-b1-07..`, `biz-meet-b2-07..`, `biz-meet-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: Business — meeting =====` + 88 chunk objects. Per level 4/4/4/4/3/3 (opener/linker/filler/closer/reaction/question). A2 ids `biz-meet-a2-05..20`, B1 `biz-meet-b1-07..22`, B2 `biz-meet-b2-07..22`, C1 `biz-meet-c1-05..20`.

Content direction — business meeting role phrases (board reviews, kickoffs, stakeholder calls):
- opener: ("to get the ball rolling", "let us start with the headline numbers", "to kick things off")
- linker: ("turning to the next item", "that brings us to", "before we dive deeper into")
- filler: ("for what it is worth", "to be transparent", "in a nutshell")
- closer: ("to take this offline", "let us circle back", "to finalize the next steps")
- reaction: ("that aligns with our goals", "I share that view", "makes perfect sense")
- question: ("what is the expected ROI", "how does this affect the timeline", "who is accountable for")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for business/meeting; count +88.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +88 biz-meet chunks incl reaction/question roles"
```

---

### Task 7: Hand-write chunk block — biz-email (+64)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== EXPANSION: Business — negotiation (A2, B1, C1) =====` marker (end of the Business — email chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 64 new chunks `biz-email-a2-05..`, `biz-email-b1-07..`, `biz-email-b2-07..`, `biz-email-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: Business — email =====` + 64 chunk objects. Per level 4/4/4/4 (opener/linker/filler/closer), NO reaction/question. A2 ids `biz-email-a2-05..20`, B1 `biz-email-b1-07..22`, B2 `biz-email-b2-07..22`, C1 `biz-email-c1-05..20`.

Content direction — business email role phrases (proposals, invoices, scheduling, partners):
- opener: ("I am writing in connection with", "per our earlier discussion", "thank you for the prompt reply")
- linker: ("in response to your query", "with regard to the invoice", "on a related note")
- filler: ("for the sake of clarity", "in due course", "needless to add")
- closer: ("we would appreciate your confirmation", "please revert at your convenience", "warm regards for now")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for business/email; count +64.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +64 biz-email chunks"
```

---

### Task 8: Hand-write chunk block — biz-neg (+76)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== 8.7 Daily — small-talk =====` marker (end of the Business — negotiation chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 76 new chunks `biz-neg-a2-05..`, `biz-neg-b1-05..`, `biz-neg-b2-08..`, `biz-neg-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: Business — negotiation =====` + 76 chunk objects. Per level 4/4/4/4/3 (opener/linker/filler/closer/question) — reaction NOT natural here, but question IS. A2 ids `biz-neg-a2-05..20`, B1 `biz-neg-b1-05..20`, B2 `biz-neg-b2-08..23`, C1 `biz-neg-c1-05..20`.

Content direction — negotiation role phrases (pricing, contracts, terms):
- opener: ("to open the negotiation", "let us put the numbers on the table", "we would like to propose")
- linker: ("if we adjust the volume", "on the topic of delivery", "as a middle ground")
- filler: ("to be quite frank", "within reason", "all else being equal")
- closer: ("to close the deal", "we are prepared to sign", "to finalize the terms")
- question: ("what is your best offer", "could you clarify the payment terms", "can you match the competitor price")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for business/negotiation; count +76.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +76 biz-neg chunks incl question role"
```

---

### Task 9: Hand-write chunk block — day-st (+88)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== EXPANSION: Daily — opinion (A2, C1, B1 closer, B2 filler) =====` marker (end of the Daily — small-talk chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 88 new chunks `day-st-a2-05..`, `day-st-b1-05..`, `day-st-b2-06..`, `day-st-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: Daily — small-talk =====` + 88 chunk objects. Per level 4/4/4/4/3/3 (opener/linker/filler/closer/reaction/question). A2 ids `day-st-a2-05..20`, B1 `day-st-b1-05..20`, B2 `day-st-b2-06..21`, C1 `day-st-c1-05..20`.

Content direction — small-talk role phrases (casual chats, social settings):
- opener: ("how has your week been", "long time no see", "any plans for the weekend")
- linker: ("speaking of which", "that reminds me", "by the way")
- filler: ("you know what I mean", "sort of", "I guess")
- closer: ("well, I should get going", "let us catch up soon", "take care of yourself")
- reaction: ("no way, really", "that sounds lovely", "oh, how interesting", "you are joking")
- question: ("what have you been up to", "how was your trip", "are you into cooking")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for daily/small-talk; count +88.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +88 day-st chunks incl reaction/question roles"
```

---

### Task 10: Hand-write chunk block — day-op (+76)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `// ===== EXPANSION: Daily — daily-work (A2, C1, B1 linker, B2 filler) =====` marker (end of the Daily — opinion chunk section).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 76 new chunks `day-op-a2-05..`, `day-op-b1-06..`, `day-op-b2-06..`, `day-op-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: Daily — opinion =====` + 76 chunk objects. Per level 4/4/4/4/3 (opener/linker/filler/closer/reaction) — question NOT natural here, reaction IS. A2 ids `day-op-a2-05..20`, B1 `day-op-b1-06..21`, B2 `day-op-b2-06..21`, C1 `day-op-c1-05..20`.

Content direction — opinion role phrases (debates, expressing views):
- opener: ("as I see it", "if you ask me", "in my view")
- linker: ("that said", "on the other hand", "having said that")
- filler: ("to some extent", "admittedly", "to tell you the truth")
- closer: ("all things considered", "to conclude", "my final take is")
- reaction: ("I could not agree more", "that is a fair point", "I respectfully disagree")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for daily/opinion; count +76.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +76 day-op chunks incl reaction role"
```

---

### Task 11: Hand-write chunk block — day-work (+64)

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — insert new block immediately BEFORE the `export const SEED_TEMPLATES: PhraseTemplate[] = [` line (end of the Daily — daily-work chunk section, i.e. end of SEED_CHUNKS).

**Interfaces:**
- Consumes: `Role` union (Task 1).
- Produces: 64 new chunks `day-work-a2-05..`, `day-work-b1-06..`, `day-work-b2-06..`, `day-work-c1-05..`.

- [ ] **Step 1: Write the block**

Insert marker `// ===== EXPANSION v2: Daily — daily-work =====` + 64 chunk objects. Per level 4/4/4/4 (opener/linker/filler/closer), NO reaction/question. A2 ids `day-work-a2-05..20`, B1 `day-work-b1-06..21`, B2 `day-work-b2-06..21`, C1 `day-work-c1-05..20`.

Content direction — daily-work role phrases (job, routines, tasks):
- opener: ("to clock in", "to tackle the first task", "here we go")
- linker: ("once that is done", "on top of that", "to begin with")
- filler: ("roughly", "more or less", "as usual")
- closer: ("to clock out", "to call it a day", "to tick everything off the list")

- [ ] **Step 2: Verify block integrity**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: no new GAPs for daily/daily-work; count +64.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +64 day-work chunks"
```

---

### Task 12: Hand-write 52 new templates

**Files:**
- Modify: `web/scripts/seed-data/phrase-seed.data.ts` — append inside `SEED_TEMPLATES`, immediately BEFORE its closing `];` (after the `// ===== EXPANSION: templates C1 =====` section).

**Interfaces:**
- Consumes: chunks from Tasks 3-11 (slot roles resolve against matching domain+context+level+role chunks); `PhraseTemplate` shape.
- Produces: templates with ids `tpl-<dom>-<ctx>-<level>-02` and `-03`. Task 13's validator checks every non-null slot role resolves.

- [ ] **Step 1: Write the templates**

Insert marker `// ===== EXPANSION v2: templates (2 per context × level) =====` + 52 `PhraseTemplate` objects.

Per (context × level) = 9 contexts × 4 levels = 36 cells: write 1 template per cell (36). For the 4 contexts with both reaction+question natural (it-meet, biz-meet, day-st) plus day-op (reaction) and biz-neg (question): write a 2nd template (16 more = 52 total). Exact 2nd-template count: it-meet ×4 levels, biz-meet ×4, day-st ×4, day-op ×4, biz-neg ×4 = 20 — so write the 2nd template ONLY for: it-meet, biz-meet, day-st (3 contexts × 4 levels = 12) + day-op (4) + biz-neg (4) = 20. TOTAL = 36 + 20 = **56 templates**.

Revised total: **56 new templates** (not 52) — within the approved 36-54+ range flexibility (spec says +36-54; 56 is the count for full natural-role coverage; if you prefer strict 54, drop the two day-op C1 + biz-neg B1 second templates — otherwise keep 56).

Id scheme:
- 1st per cell: `tpl-<dom>-<ctx>-<level>-02` (e.g. `tpl-it-meet-a2-02`)
- 2nd per cell: `tpl-<dom>-<ctx>-<level>-03`

Template content rules:
- Each template has `structure` using `{chunk:role}` placeholders for slots that resolve by role (e.g. `{chunk:opener} — {chunk:linker} the {noun}?`), plus `{name}` placeholders for options-slots (`{name, role:null, options:[...]}`).
- Non-null role slots must use roles that exist in that context×level (core 4 always; reaction only in it-meet/biz-meet/day-st/day-op; question only in it-meet/biz-meet/biz-neg/day-st; NEVER reaction/question in it-email/biz-email/it-inc/day-work).
- Every slot role must resolve: for each non-null slot role, a chunk with matching domain+context+level+role must exist (they do, from Tasks 3-11).
- Each template has `english` (example filled sentence), `vietnamese`, `example: {en, vi}`.
- `english` of templates must NOT collide with chunk `english` values (validator/dedup covers template ids only; still keep sentence-level english distinct).

- [ ] **Step 2: Verify slot resolution**

Run: `/tmp/seedcheck/validate.mts` (re-copy + sed).
Expected: `ALL TEMPLATE SLOTS RESOLVE ✓`, 0 GAPS, template count = 45 + 56 = 101.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): +56 templates with reaction/question slots"
```

---

### Task 13: Dedup script, full validation, tsc + tests, final commit

**Files:**
- Create: `/tmp/seedcheck/dedup.mts` (throwaway script — not committed)
- Verify: `web/scripts/seed-data/phrase-seed.data.ts`

**Interfaces:**
- Consumes: completed Tasks 3-12 (all chunks + templates in place).
- Produces: proof of data integrity; final green build; final commit.

- [ ] **Step 1: Write the dedup script**

Create `/tmp/seedcheck/dedup.mts`:

```typescript
import { SEED_CHUNKS, SEED_TEMPLATES } from './phrase-seed.data';

const ids = new Set<string>();
const eng = new Set<string>();
let dupIds = 0, dupEng = 0;
for (const c of SEED_CHUNKS) {
  if (ids.has(c.id)) { console.error('DUP ID', c.id); dupIds++; }
  ids.add(c.id);
  if (eng.has(c.english.toLowerCase())) { console.error('DUP EN', c.english); dupEng++; }
  eng.add(c.english.toLowerCase());
}
for (const t of SEED_TEMPLATES) {
  if (ids.has(t.id)) { console.error('DUP TPL ID', t.id); dupIds++; }
  ids.add(t.id);
}
console.log(`chunks=${SEED_CHUNKS.length} templates=${SEED_TEMPLATES.length} dupIds=${dupIds} dupEng=${dupEng}`);
```

Copy `web/scripts/seed-data/phrase-seed.data.ts` to `/tmp/seedcheck/phrase-seed.data.ts`, then sed-fix its import (`'../../src/app/sub-app/phrase-lab/models/phrase.model'` → `'./phrase.model'`).

- [ ] **Step 2: Run dedup + validator**

Run from `web/`:
```bash
cp scripts/seed-data/phrase-seed.data.ts /tmp/seedcheck/phrase-seed.data.ts
sed -i '' "s#'../../src/app/sub-app/phrase-lab/models/phrase.model'#'./phrase.model'#" /tmp/seedcheck/phrase-seed.data.ts
npx tsx /tmp/seedcheck/dedup.mts
npx tsx /tmp/seedcheck/validate.mts
```
Expected: `chunks=829 templates=101 dupIds=0 dupEng=0` (chunks 173+656 net — exact total = 173 + (88+64+64+88+64+76+88+76+64) = 173+672 = 845; adjust assertion to actual counts as long as dupIds=0 and dupEng=0) and `ALL TEMPLATE SLOTS RESOLVE ✓` with 0 GAPS. (If chunk count differs slightly from 845 because a task wrote fewer than planned, that is acceptable — the hard gates are dupIds=0, dupEng=0, 0 GAPS.)

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit` from `web/`
Expected: EXIT 0, no errors.

- [ ] **Step 4: Run the phrase-lab test suite**

Run: `npx ng test --watch=false` from `web/`
Expected: all phrase-lab specs pass. ONE known pre-existing failure outside phrase-lab is acceptable: `AppComponent should render title` (src/app/app.component.spec.ts:27 — stale scaffold test, untouched by this work).

- [ ] **Step 5: Final commit**

```bash
git add web/scripts/seed-data/phrase-seed.data.ts
git commit -m "feat(phrase-lab): expand seed to 845 chunks + 101 templates with reaction/question roles"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Part 1 (Role union, ROLE_COLOR) → Tasks 1-2. Part 2 (production plan) → Tasks 3-11 counts (88+64+64+88+64+76+88+76+64 = 672 chunks, within +500-700) and Task 12 (56 templates, natural-gap contexts respected). Part 3 (workflow) → every task's verify + commit steps, dedup/validator in Task 13, no push.
- [ ] **Placeholder scan:** no TBD/TODO/"similar to Task N" — each block task has its own content direction and id ranges; every step has exact commands and expected output.
- [ ] **Type consistency:** `Role` members `reaction`/`question` used identically in Tasks 1-2 and in slot-role rules of Task 12; chunk ids follow `<dom>-<ctx>-<level>-<nn>`; template ids `tpl-<dom>-<ctx>-<level>-02/-03` consistent throughout.
- [ ] **Known deviations from spec:** (a) per-context chunk counts are 64-88 (spec said "≈70-75 per context overall") — the aggregate 672 lands inside the approved +500-700; (b) template count 56 vs spec "+36-54" — 56 is needed for full natural-role 2nd templates; drop 2 as noted if strict adherence required.

