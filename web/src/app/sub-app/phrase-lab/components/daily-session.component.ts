import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { PhraseChunk, ReviewRating } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';

const DUE_LIMIT = 10;
const NEW_LIMIT = 5;

const RATING_LABELS: Record<ReviewRating, string> = {
  again: 'Again — sẽ ôn lại hôm nay',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

@Component({
  selector: 'app-daily-session',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-slate-800">Phiên hôm nay</h3>
        @if (sessionQueue().length) {
          <span class="rounded-full bg-slate-800 text-white text-xs px-3 py-1">{{ index() + 1 }}/{{ sessionQueue().length }}</span>
        }
      </div>

      @if (!done() && current(); as c) {
        <p class="text-xs font-medium text-slate-400">{{ isNew() ? 'Mới' : 'Ôn tập' }}</p>
        <p class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ c.english }}</p>
        @if (showVi()) {
          <p class="text-sm text-slate-500">{{ c.vietnamese }}</p>
          <p class="text-xs text-slate-400">{{ c.phonetic }}</p>
          @if (c.usage) {
            <p class="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">💡 {{ c.usage }}</p>
          }
        }
        <div class="flex gap-2">
          <button (click)="listen()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">🐢 Nghe</button>
          <button (click)="showVi.set(!showVi())" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">{{ showVi() ? '🙈 Ẩn nghĩa' : '👀 Nghĩa' }}</button>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <button (click)="rate('again')" class="rounded-xl bg-red-100 text-red-700 py-2 text-sm font-medium">Again</button>
          <button (click)="rate('hard')" class="rounded-xl bg-amber-100 text-amber-700 py-2 text-sm font-medium">Hard</button>
          <button (click)="rate('good')" class="rounded-xl bg-emerald-100 text-emerald-700 py-2 text-sm font-medium">Good</button>
          <button (click)="rate('easy')" class="rounded-xl bg-sky-100 text-sky-700 py-2 text-sm font-medium">Easy</button>
        </div>
        @if (ratedLabel()) {
          <p class="text-xs text-emerald-600">{{ ratedLabel() }}</p>
        }
      } @else if (done()) {
        <div class="space-y-3 text-center py-6">
          <p class="text-3xl">🎉</p>
          <p class="font-semibold text-slate-800">Hoàn thành phiên hôm nay!</p>
          <p class="text-sm text-slate-500">Đã xử lý {{ rated() }} chunk — {{ dueTotal() }} ôn tập, {{ newTotal() }} mới.</p>
          <button (click)="restart()" class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">Làm lại</button>
        </div>
      } @else {
        <p class="text-sm text-slate-500 py-6 text-center">Chưa có chunk cần ôn hôm nay — hãy khám phá thêm để bắt đầu!</p>
      }
    </div>
  `,
})
export class DailySessionComponent {
  private readonly content = inject(PhraseContentService);
  private readonly progress = inject(PhraseProgressService);
  private readonly speech = inject(SpeechService);

  readonly sessionQueue = signal<PhraseChunk[]>([]);
  readonly sessionDueIds = signal<string[]>([]);
  readonly index = signal(0);
  readonly done = signal(false);
  readonly rated = signal(0);
  readonly ratedLabel = signal<string | null>(null);
  readonly showVi = signal(false);
  readonly dueTotal = signal(0);
  readonly newTotal = signal(0);

  private started = false;

  readonly current = computed(() => this.sessionQueue()[this.index()] ?? null);

  readonly isNew = computed(() => {
    const c = this.current();
    return c ? !this.sessionDueIds().includes(c.id) : false;
  });

  constructor() {
    effect(
      () => {
        if (this.started) return;
        const chunks = this.content.chunks();
        if (chunks.length) {
          this.buildQueue(chunks);
        }
      },
      { allowSignalWrites: true },
    );
  }

  private buildQueue(chunks: PhraseChunk[]): void {
    const allIds = chunks.map((c) => c.id);
    const dueIds = this.progress.getDueChunks(allIds).slice(0, DUE_LIMIT);
    const due = chunks.filter((c) => dueIds.includes(c.id));
    const coverage = this.progress.getCoverage(chunks);
    const p = this.progress.progress();
    const reviewed = new Set(Object.keys(p?.reviews ?? {}));
    const mastered = new Set(
      Object.keys(p?.masteredChunks ?? {}).filter((id) => p?.masteredChunks[id]?.status === 'mastered'),
    );
    const isNew = chunks
      .filter((c) => !dueIds.includes(c.id) && !reviewed.has(c.id) && !mastered.has(c.id))
      .sort((a, b) => {
        const ra = coverage[a.context] ? coverage[a.context].learned / coverage[a.context].total : 0;
        const rb = coverage[b.context] ? coverage[b.context].learned / coverage[b.context].total : 0;
        return ra - rb || a.id.localeCompare(b.id);
      })
      .slice(0, NEW_LIMIT);
    this.sessionDueIds.set(dueIds);
    this.sessionQueue.set([...due, ...isNew]);
    this.dueTotal.set(due.length);
    this.newTotal.set(isNew.length);
  }

  listen(): void {
    const c = this.current();
    if (c) this.speech.speak(c.english, 'en-US');
  }

  async rate(rating: ReviewRating): Promise<void> {
    const c = this.current();
    if (!c) return;
    this.started = true;
    this.ratedLabel.set(RATING_LABELS[rating]);
    await this.progress.reviewChunk(c.id, rating);
    this.rated.set(this.rated() + 1);
    if (this.index() + 1 < this.sessionQueue().length) {
      this.index.set(this.index() + 1);
    } else {
      this.done.set(true);
    }
    this.showVi.set(false);
  }

  restart(): void {
    this.started = false;
    this.index.set(0);
    this.rated.set(0);
    this.done.set(false);
    this.ratedLabel.set(null);
    this.showVi.set(false);
    const chunks = this.content.chunks();
    if (chunks.length) this.buildQueue(chunks);
  }
}
