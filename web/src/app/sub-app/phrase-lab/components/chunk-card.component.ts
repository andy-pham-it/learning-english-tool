import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PhraseChunk } from '../models/phrase.model';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';

const ROLE_COLOR: Record<string, string> = {
  opener: 'bg-blue-100 text-blue-700',
  linker: 'bg-purple-100 text-purple-700',
  filler: 'bg-orange-100 text-orange-700',
  closer: 'bg-green-100 text-green-700',
  reaction: 'bg-rose-100 text-rose-700',
  question: 'bg-amber-100 text-amber-700',
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
