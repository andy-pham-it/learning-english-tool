import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhraseChunk, Role } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';
import { buildModelPassage, computeFeedback, pickChunks, SpeakingChainFeedback } from '../utils/speaking-chain.util';

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

const CHAIN_ROLES: Role[] = ['opener', 'linker', 'linker', 'filler', 'closer'];

@Component({
  selector: 'app-speaking-chain',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 class="mb-3 text-lg font-bold text-slate-800">Chuỗi nói</h2>
      <p class="mb-3 text-sm text-slate-500">Chọn chủ đề, tạo chuỗi chunk rồi nói thành đoạn ~30 giây. Hệ thống sẽ ghi lại và chấm xem bạn dùng đủ chunk chưa.</p>

      @if (contexts().length) {
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <select
            (change)="selectContext($any($event.target).value)"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Chọn chủ đề…</option>
            @for (ctx of contexts(); track ctx) {
              <option [value]="ctx" [selected]="ctx === context()">{{ ctx }}</option>
            }
          </select>
          <button
            (click)="generate()"
            [disabled]="!context()"
            class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Tạo chuỗi
          </button>
        </div>
      } @else {
        <p class="text-sm text-slate-400">Đang tải dữ liệu…</p>
      }

      @if (chunks().length) {
        <div class="mb-3 flex flex-wrap gap-2">
          @for (c of chunks(); track c.id) {
            <span class="rounded-full px-3 py-1 text-xs font-medium {{ badge(c.role) }}">
              {{ label(c.role) }} · {{ c.english }}
            </span>
          }
        </div>

        <div class="mb-3 flex items-center gap-3">
          <span class="text-2xl font-bold text-slate-800">{{ timer() }}s</span>
          <button
            (click)="isRunning() ? stopTimer() : startTimer()"
            class="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {{ isRunning() ? '⏹ Dừng' : '▶ Bắt đầu' }}
          </button>
          @if (supported) {
            <button
              (click)="startSpeaking()"
              class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white"
              [class.animate-pulse]="isListening()"
            >
              {{ isListening() ? 'Đang nghe…' : '🎤 Nói' }}
            </button>
          }
          <button (click)="playModel()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">🔊 Nghe đoạn mẫu</button>
        </div>

        @if (modelPassage()) {
          <div class="mb-3 rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Đoạn mẫu</p>
            <p class="text-sm text-slate-700">{{ modelPassage() }}</p>
          </div>
        }

        @if (feedback(); as fb) {
          <div class="space-y-2 rounded-xl bg-slate-50 p-3">
            <p class="text-sm font-semibold text-slate-700">Phản hồi</p>
            <p class="text-sm">
              Chunk dùng được: <span class="font-medium text-emerald-600">{{ fb.covered.length }}/{{ fb.covered.length + fb.missed.length }}</span>
              @if (fb.missed.length) {
                <span class="text-slate-400"> · thiếu: <span class="text-red-600">{{ fb.missed.join(', ') }}</span></span>
              }
            </p>
            <p class="text-sm">Tốc độ: <span class="font-medium">{{ fb.wpm }} từ/phút</span></p>
            <p class="text-sm">
              Filler:
              @if (fb.fillers.length) {
                <span class="font-medium text-orange-600">{{ fb.fillers.join(', ') }}</span>
              } @else {
                <span class="text-slate-400">không phát hiện</span>
              }
            </p>
          </div>
        }
      }
    </div>
  `,
})
export class SpeakingChainComponent {
  private readonly content = inject(PhraseContentService);
  private readonly speech = inject(SpeechService);

  readonly context = signal<string | null>(null);
  readonly chunks = signal<PhraseChunk[]>([]);
  readonly modelPassage = signal('');
  readonly timer = signal(30);
  readonly isRunning = signal(false);
  readonly isListening = signal(false);
  readonly feedback = signal<SpeakingChainFeedback | null>(null);
  readonly supported = this.speech.isRecognitionSupported();

  private offset = 0;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  readonly contexts = computed(() => {
    const set = new Set(this.content.chunks().map((c) => c.context));
    return [...set].sort();
  });

  selectContext(ctx: string): void {
    this.context.set(ctx || null);
    this.offset = 0;
    this.chunks.set([]);
    this.modelPassage.set('');
    this.feedback.set(null);
  }

  generate(): void {
    const ctx = this.context();
    if (!ctx) {
      return;
    }
    const pool = this.content.chunks().filter((c) => c.context === ctx);
    const picked = pickChunks(pool, CHAIN_ROLES, this.offset);
    this.offset++;
    this.chunks.set(picked);
    this.modelPassage.set(buildModelPassage(picked));
    this.feedback.set(null);
  }

  startTimer(): void {
    if (this.timerHandle) {
      return;
    }
    this.timer.set(30);
    this.isRunning.set(true);
    this.timerHandle = setInterval(() => {
      const next = this.timer() - 1;
      this.timer.set(next);
      if (next <= 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    this.isRunning.set(false);
  }

  async startSpeaking(): Promise<void> {
    if (!this.supported) {
      return;
    }
    this.isListening.set(true);
    try {
      const transcript = await this.speech.startListening('en-US');
      const durationSec = 30 - this.timer();
      this.feedback.set(computeFeedback(this.chunks(), transcript, durationSec));
    } finally {
      this.isListening.set(false);
    }
  }

  playModel(): void {
    if (this.modelPassage()) {
      this.speech.speak(this.modelPassage(), 'en-US');
    }
  }

  badge(role: Role): string {
    return ROLE_BADGE[role] ?? 'bg-slate-100 text-slate-600';
  }

  label(role: Role): string {
    return ROLE_LABEL[role] ?? role;
  }
}
