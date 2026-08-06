# Phrase Lab — Chunk Expansion Design (v2)

**Date:** 2026-08-06
**Status:** Approved (3/3 design parts)

## Goal

Expand the Phrase Lab seed data substantially so practice sessions repeat far less:
grow the chunk library from **173 → ~840 chunks** (+660-670) and the template
library from **45 → ~80-100 templates** (+36-54), while extending the role system
with two new natural-sounding roles: **reaction** and **question**.

## Current State (baseline, committed in `cd504f1`)

- **Domains (3):** `it`, `business`, `daily`
- **Contexts (9):** `it-meet`, `it-email`, `it-inc`, `biz-meet`, `biz-email`,
  `biz-neg`, `day-st` (small-talk), `day-op` (opinion), `day-work`
- **Roles (4):** `opener | linker | filler | closer`
- **Levels (4):** `A2 | B1 | B2 | C1`
- **Chunks:** 173 (it 61, business 59, daily 53; levels A2 36 / B1 47 / B2 54 / C1 36;
  roles opener 48 / linker 41 / closer 46 / filler 38)
- **Templates:** 45 (18 original B2, 2/context + 9 A2 + 9 B1 + 9 C1, 1/context/level)
- **Known gap:** `daily/small-talk/B1` has no filler chunk (only opener 2, linker 1, closer 1)

## Design Part 1 — Data model & code changes for 2 new roles

**Files changed (3):**

1. `web/src/app/sub-app/phrase-lab/models/phrase.model.ts`
   - `export type Role = 'opener' | 'linker' | 'filler' | 'closer' | 'reaction' | 'question';`
   - No other model changes (PhraseChunk/PhraseTemplate/PhraseProgress shapes unchanged).

2. `web/src/app/sub-app/phrase-lab/components/chunk-card/chunk-card.component.ts`
   - ROLE_COLOR map additions: `reaction: 'bg-rose-100 text-rose-700'`,
     `question: 'bg-amber-100 text-amber-700'` (record is `Record<string,string>`).

3. Validator `/tmp/seedcheck/validate.mts` — **no logic change.**
   - It only checks template-slot resolution (non-null `slot.role` must have ≥1 chunk
     matching domain+context+level+role). "Natural gaps" for email/incident are expressed
     by simply NOT declaring reaction/question slots in those templates.
   - If a stricter chunk-coverage check is ever added, it must whitelist reaction/question
     as optional roles.

**Verified safe (no changes):** `phrase-engine.service.ts`, `role-combiner.component.ts`,
`phrase-lab-page.component.ts` — all role logic is generic string comparison
(`c.role === slot.role`, `slot.role` label rendering). No hardcoded Role arrays exist.

**No changes:** services, storage, progress, routing.

## Design Part 2 — Production plan (~660-670 chunks, +36-54 templates)

### Chunk distribution

- **Core 4 roles** (opener/linker/filler/closer): **~4-5 new chunks per (context, level, role) cell**
  → 9 contexts × 4 levels × 4 roles × ~4.5 ≈ **~570-580 chunks**
- **reaction role** — natural contexts only: `it-meet`, `biz-meet`, `day-st`, `day-op`
  → ~3 per level per context ≈ **~45 chunks**
- **question role** — natural contexts only: `it-meet`, `biz-meet`, `biz-neg`, `day-st`
  → ~3 per level per context ≈ **~45 chunks**
- **Excluded cells:** `it-email`, `biz-email`, `it-inc` get NO reaction/question chunks
  (emails and incident reports are not natural venues for casual reactions/questions)
- Per-context total ≈ **70-75 chunks** → ~660-670 overall. Seed grows 173 → ~840.

### Template expansion

- **+36-54 templates** (1-2 per context × level), ids `tpl-<dom>-<ctx>-<level>-<nn>`
  (e.g. `tpl-it-meet-b2-03`).
- Templates for natural contexts may include reaction/question slots.
- Templates for `it-email`, `biz-email`, `it-inc` use only the 4 core roles.
- Validator guarantees every declared slot resolves (incl. new-role slots).

### Content constraints

- **No duplicate `english`** vs the existing 173 chunks (script check).
- No duplicate vs other new chunks in the same batch.
- Full phonetics on every chunk.
- Natural, level-appropriate examples (1-2 each, `{en, vi}`).

## Design Part 3 — Writing & verification workflow (approved)

1. **Hand-write 9 per-context blocks** in SEED_CHUNKS order:
   `it-meet`, `it-email`, `it-inc`, `biz-meet`, `biz-email`, `biz-neg`,
   `day-st`, `day-op`, `day-work`.
   - Each block prefixed with `// ===== EXPANSION: <domain> — <context> =====`
     matching the existing section-marker convention
     (these comments are NECESSARY navigational markers in a ~5000-line data file).
2. **Chunk shape:** full `{id, domain, context, level, english, vietnamese, phonetic, role, examples}`.
3. **IDs:** continue existing numbering per cell (e.g. `it-meet-b2-08`); no collisions.
4. **Re-validate:** `/tmp/seedcheck/validate.mts` (re-copy data file + sed import fix to
   `./phrase.model`) — expect ALL TEMPLATE SLOTS RESOLVE including new reaction/question slots.
5. **Dedup script:** unique ids; no duplicate english; per-cell role counts
   (≈4-5 core per cell; reaction/question only in whitelisted contexts).
6. **Typecheck + tests:** `npx tsc --noEmit` clean; `npx ng test` from `web/`
   (one pre-existing AppComponent scaffold failure is accepted and unrelated).
7. **Commit:** style `feat(phrase-lab): ...`, NOT pushed (user runs `/ship`).
8. **Re-seed command delivered:**
   `cd web && GOOGLE_APPLICATION_CREDENTIALS="$HOME/Downloads/learning-english-tool-sa.json" npx tsx scripts/seed-phrase-lab.ts`
   (idempotent, `batch.set` by id).

## Out of scope

- New domains or contexts (explicitly declined by user).
- Runtime/script-generated chunks (user chose hand-written blocks over the
  phrase-bank + generator approach).
- Data model migration or progress storage changes.
- Changes to `it-email`, `biz-email`, `it-inc` beyond core-role chunk additions.

## Success criteria

- [ ] Seed file contains ~840 chunks (173 + ~660-670) with unique ids and no duplicate english.
- [ ] ~80-100 templates total, all slots resolving (validator passes).
- [ ] `Role` type extended; chunk-card colors for reaction/question render correctly.
- [ ] `npx tsc --noEmit` clean; phrase-lab test suite passes.
- [ ] Committed locally (not pushed) as `feat(phrase-lab): ...`.
