import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PhraseChunk } from '../models/phrase.model';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';
import { ProgressRingComponent } from '../../../shared/ui/progress-ring.component';

const ROLE_COLOR: Record<string, string> = {
  opener: 'bg-blue-100 text-blue-700',
  linker: 'bg-purple-100 text-purple-700',
  filler: 'bg-orange-100 text-orange-700',
  closer: 'bg-green-100 text-green-700',
  reaction: 'bg-rose-100 text-rose-700',
  question: 'bg-amber-100 text-amber-700',
};

const LEVEL_COLOR: Record<string, string> = {
  A1: 'bg-emerald-100 text-emerald-700',
  A2: 'bg-sky-100 text-sky-700',
  B1: 'bg-violet-100 text-violet-700',
  B2: 'bg-amber-100 text-amber-700',
  C1: 'bg-orange-100 text-orange-700',
  C2: 'bg-rose-100 text-rose-700',
};

@Component({
  selector: 'app-chunk-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProgressRingComponent],
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 shadow-sm border border-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <div class="flex items-start justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1">
          <span [class]="'text-xs font-medium px-2 py-0.5 rounded-full ' + roleColor()">{{ chunk().role }}</span>
          <span data-test="level-badge" [class]="'text-xs font-medium px-2 py-0.5 rounded-full ' + levelColor()">{{ chunk().level }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800">{{ chunk().english }}</p>
          <p class="text-slate-500 text-sm">{{ chunk().phonetic }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 p-2 text-slate-600"
          aria-label="Nghe mẫu"
          (click)="speak(chunk().english)"
        >🔊</button>
      </div>
      <p class="mt-1 text-sm text-slate-700">{{ chunk().vietnamese }}</p>
      @if (chunk().usage) {
        <div class="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          <p class="text-xs font-medium text-amber-700">Khi nào dùng?</p>
          <p class="text-sm text-amber-900">{{ chunk().usage }}</p>
        </div>
      }
      @if (chunk().examples.length) {
        <ul class="mt-2 space-y-1">
          @for (ex of chunk().examples; track $index) {
            <li>
              <p class="italic text-slate-500">{{ ex.en }}</p>
              <p class="text-xs text-slate-400">{{ ex.vi }}</p>
            </li>
          }
        </ul>
      }
      <div class="mt-3 flex items-center gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl py-2 text-sm font-medium transition disabled:bg-emerald-100 disabled:text-emerald-700 enabled:bg-slate-800 enabled:text-white hover:enabled:bg-slate-700"
          (click)="learn()"
          [disabled]="mastered()"
        >{{ mastered() ? 'Đã học ✓' : 'Đã học' }}</button>
        <app-progress-ring [progress]="cardProgress()" [size]="20" [strokeWidth]="3" title="Mức độ thành thạo" />
      </div>
    </div>
  `,
})
export class ChunkCardComponent {
  readonly chunk = input.required<PhraseChunk>();
  private readonly progress = inject(PhraseProgressService);
  private readonly speech = inject(SpeechService);

  readonly roleColor = computed(() => ROLE_COLOR[this.chunk().role] ?? 'bg-slate-100 text-slate-600');
  readonly levelColor = computed(() => LEVEL_COLOR[this.chunk().level] ?? LEVEL_COLOR['A1']);

  readonly mastered = computed(() => !!this.progress.progress()?.masteredChunks[this.chunk().id]);

  readonly cardProgress = computed(() => {
    const p = this.progress.progress();
    if (!p) return 0;
    if (p.masteredChunks[this.chunk().id]?.status === 'mastered') return 100;
    if (p.reviews[this.chunk().id]) return 50;
    return 0;
  });

  learn(): void {
    void this.progress.markChunkLearned(this.chunk().id);
  }

  speak(text: string): void {
    this.speech.speak(text);
  }
}