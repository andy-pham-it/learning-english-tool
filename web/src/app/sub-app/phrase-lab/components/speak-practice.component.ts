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
