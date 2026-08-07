import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhraseChunk, ReviewRating, Role } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';

const RATING_LABELS: Record<ReviewRating, string> = {
  again: 'Again — sẽ ôn lại hôm nay',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

const ROLE_BADGE: Record<string, string> = {
  opener: 'bg-blue-100 text-blue-700',
  linker: 'bg-purple-100 text-purple-700',
  filler: 'bg-orange-100 text-orange-700',
  closer: 'bg-green-100 text-green-700',
  reaction: 'bg-rose-100 text-rose-700',
  question: 'bg-amber-100 text-amber-700',
};

const ROLE_LABEL: Record<string, string> = {
  opener: 'Mở đầu',
  linker: 'Nối',
  filler: 'Chêm',
  closer: 'Kết',
  reaction: 'Phản hồi',
  question: 'Hỏi',
};

@Component({
  selector: 'app-conversation-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-lg font-bold text-slate-800">Hội thoại</h2>

      @if (contexts().length) {
        <select
          class="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none"
          [value]="selectedContext() ?? ''"
          (change)="selectContext($any($event.target).value)"
        >
          <option value="">— Chọn chủ đề —</option>
          @for (ctx of contexts(); track ctx) {
            <option [value]="ctx">{{ ctx }}</option>
          }
        </select>
      }

      @if (selectedContext() && dialogue().length) {
        <ol class="space-y-2">
          @for (c of dialogue(); track c.id; let i = $index) {
            <li class="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold {{ badge(c.role) }}">
                    {{ i + 1 }} · {{ label(c.role) }}
                  </span>
                  <span class="text-sm font-medium text-slate-800">{{ c.english }}</span>
                </div>
                <button
                  class="shrink-0 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  (click)="listen(c)"
                >
                  🐢 Nghe
                </button>
              </div>

              @if (showVi()) {
                <p class="mt-1 text-xs text-slate-500">{{ c.vietnamese }}</p>
                <p class="mt-0.5 text-[11px] italic text-slate-400">{{ c.phonetic }}</p>
              }

              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span class="text-[11px] text-slate-400">Bạn nói chuẩn chưa?</span>
                @for (r of ratings(); track r) {
                  <button
                    class="rounded-full px-2 py-0.5 text-[11px] font-medium {{ ratingChip(r) }}"
                    (click)="rate(c, r)"
                  >
                    {{ label(r) }}
                  </button>
                }
              </div>
            </li>
          }
        </ol>

        <div class="mt-3 flex items-center justify-between gap-2">
          <button
            class="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            (click)="toggleVi()"
          >
            {{ showVi() ? '🙈 Ẩn nghĩa' : '👀 Nghĩa' }}
          </button>
          <button
            class="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
            (click)="nextDialogue()"
          >
            Hội thoại khác
          </button>
        </div>
      } @else if (selectedContext()) {
        <p class="py-6 text-center text-sm text-slate-400">Chưa có chunk cho chủ đề này — hãy khám phá thêm!</p>
      } @else {
        <p class="py-6 text-center text-sm text-slate-400">Chọn một chủ đề để ghép thành hội thoại mẫu.</p>
      }
    </div>
  `,
})
export class ConversationBuilderComponent {
  private readonly content = inject(PhraseContentService);
  private readonly progress = inject(PhraseProgressService);
  private readonly speech = inject(SpeechService);

  readonly selectedContext = signal<string | null>(null);
  readonly dialogue = signal<PhraseChunk[]>([]);
  readonly showVi = signal(false);
  readonly ratedLabel = signal<string | null>(null);

  private offset = 0;

  readonly contexts = computed(() => {
    const set = new Set(this.content.chunks().map((c) => c.context));
    return [...set].sort();
  });

  readonly ratings = (): ReviewRating[] => ['again', 'hard', 'good', 'easy'];

  selectContext(ctx: string): void {
    this.selectedContext.set(ctx || null);
    this.offset = 0;
    this.dialogue.set(ctx ? this.buildDialogue(ctx) : []);
    this.ratedLabel.set(null);
  }

  nextDialogue(): void {
    const ctx = this.selectedContext();
    if (!ctx) {
      return;
    }
    this.offset++;
    this.dialogue.set(this.buildDialogue(ctx));
    this.ratedLabel.set(null);
  }

  private buildDialogue(ctx: string): PhraseChunk[] {
    const pool = this.content.chunks().filter((c) => c.context === ctx);
    return [
      ...this.pick(pool, 'opener', 1),
      ...this.pick(pool, 'linker', 2),
      ...this.pick(pool, 'filler', 1),
      ...this.pick(pool, 'closer', 1),
      ...this.pick(pool, 'reaction', 1),
    ];
  }

  private pick(pool: PhraseChunk[], role: Role, n: number): PhraseChunk[] {
    const cands = pool.filter((c) => c.role === role).sort((a, b) => a.id.localeCompare(b.id));
    if (!cands.length) {
      return [];
    }
    const start = this.offset % cands.length;
    const out: PhraseChunk[] = [];
    for (let i = 0; i < n && i < cands.length; i++) {
      out.push(cands[(start + i) % cands.length]);
    }
    return out;
  }

  listen(c: PhraseChunk): void {
    this.speech.speak(c.english, 'en-US');
  }

  rate(c: PhraseChunk, rating: ReviewRating): void {
    this.ratedLabel.set(RATING_LABELS[rating]);
    void this.progress.reviewChunk(c.id, rating);
  }

  toggleVi(): void {
    this.showVi.set(!this.showVi());
  }

  badge(role: Role): string {
    return ROLE_BADGE[role] ?? 'bg-slate-100 text-slate-600';
  }

  label(role: Role): string {
    return ROLE_LABEL[role] ?? role;
  }

  ratingChip(r: ReviewRating): string {
    const map: Record<ReviewRating, string> = {
      again: 'bg-red-100 text-red-700',
      hard: 'bg-amber-100 text-amber-700',
      good: 'bg-emerald-100 text-emerald-700',
      easy: 'bg-sky-100 text-sky-700',
    };
    return map[r];
  }
}
