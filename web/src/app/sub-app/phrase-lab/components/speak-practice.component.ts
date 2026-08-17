import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, output, signal } from '@angular/core';
import { PhraseTemplate, ReviewRating } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';

@Component({
  selector: 'app-speak-practice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
       <h3 class="font-semibold text-slate-800 flex items-center justify-between">
         <span>Luyện nói</span>
         <div class="flex gap-2">
           <button
             (click)="toggleProductionMode()"
             class="rounded-full border px-3 py-1 text-xs transition-colors"
             [class.bg-amber-100]="productionMode()"
             [class.border-amber-300]="productionMode()"
             [class.text-amber-900]="productionMode()"
             [class.border-slate-200]="!productionMode()">
             {{ productionMode() ? '🎯 Mode: Production' : '📖 Mode: Normal' }}
           </button>
           <button
             (click)="toggleShadow()"
             class="rounded-full border border-slate-200 px-3 py-1 text-xs"
             [attr.aria-pressed]="hideText()">
             {{ hideText() ? '👁 Hiện chữ' : '🙈 Shadowing' }}
           </button>
         </div>
       </h3>
       @if (productionMode()) {
         @if (showProductionAnswer()) {
           <p class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed font-medium">{{ target() }} <span class="text-xs text-amber-600 block mt-1">(Đáp án đã hiển thị)</span></p>
         } @else {
           <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
             <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide">🎯 Tự nói câu tiếng Anh từ nghĩa tiếng Việt:</p>
             <p class="text-base text-amber-900 font-medium">{{ template().vietnamese }}</p>
             <button (click)="revealProductionAnswer()" class="rounded-xl bg-amber-600 px-3 py-1.5 text-xs text-white">💡 Xem đáp án</button>
           </div>
         }
       } @else {
         @if (hideText()) {
           <p class="rounded-xl bg-slate-50 p-3 text-slate-400 leading-relaxed">🔇 Chữ đang ẩn — hãy nghe rồi nhắc lại thật to, sau đó bấm "Hiện chữ" để so sánh.</p>
         } @else {
           <p class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ target() }}</p>
         }
       }
      <div class="flex gap-2 flex-wrap">
        <button (click)="listenSlow()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">🐢 Nghe chậm</button>
        @if (supported) {
          <button
            (click)="startListening()"
            class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white"
            [class.animate-pulse]="isListening()">
            {{ isListening() ? 'Đang nghe...' : '🎤 Đọc câu này' }}
          </button>
        }
        <button
          (click)="toggleRecording()"
          class="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          [class.bg-rose-100]="recording()">
          {{ recording() ? '⏹ Dừng ghi' : '⏺ Ghi âm' }}
        </button>
        @if (recordingUrl()) {
          <button (click)="playRecording()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">▶ Nghe lại</button>
        }
      </div>
      <div class="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
        <p class="text-xs font-semibold text-indigo-700 uppercase tracking-wide">🙈 Shadowing — nghe rồi lặp lại</p>
        <div class="flex gap-1.5 flex-wrap">
          @for (opt of shadowSpeeds; track opt.value) {
            <button
              (click)="setShadowSpeed(opt.value)"
              class="rounded-full border px-3 py-1 text-xs"
              [class.bg-indigo-600]="shadowSpeed() === opt.value"
              [class.text-white]="shadowSpeed() === opt.value"
              [class.border-indigo-300]="shadowSpeed() === opt.value"
              [class.border-slate-200]="shadowSpeed() !== opt.value">
              {{ opt.label }}
            </button>
          }
        </div>
        <div class="flex gap-2 flex-wrap">
          <button (click)="playShadow()" class="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white">▶ Nghe</button>
          @if (supported) {
            <button
              (click)="repeatShadow()"
              class="rounded-xl bg-indigo-800 px-4 py-2 text-sm text-white"
              [class.animate-pulse]="shadowStep() === 'listening'">
              {{ shadowStep() === 'listening' ? 'Đang nghe...' : '🎤 Lặp lại' }}
            </button>
          }
        </div>
        @if (shadowScore() !== null) {
          <p class="text-sm font-bold" [class.text-emerald-600]="shadowScore()! >= 80" [class.text-amber-500]="shadowScore()! >= 50 && shadowScore()! < 80" [class.text-red-600]="shadowScore()! < 50">
            Từ xuất hiện đúng: {{ shadowScore() }}/100
          </p>
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
          <div class="flex gap-2 flex-wrap">
            <button (click)="rate('again')" class="rounded-xl bg-red-600 px-3 py-2 text-sm text-white">Again</button>
            <button (click)="rate('hard')" class="rounded-xl bg-amber-500 px-3 py-2 text-sm text-white">Hard</button>
            <button (click)="rate('good')" class="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white">Good</button>
            <button (click)="rate('easy')" class="rounded-xl bg-sky-600 px-3 py-2 text-sm text-white">Easy</button>
          </div>
          @if (ratedLabel()) {
            <p class="text-xs text-slate-500">Đã chấm: {{ ratedLabel() }}</p>
          }
          <button (click)="markMastered()" [disabled]="masteredDone()" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-40">Tôi đã nói chuẩn ✓</button>
        </div>
      }
    </div>
  `,
})
export class SpeakPracticeComponent implements OnDestroy {
  readonly template = input.required<PhraseTemplate>();
  readonly mastered = output<{ templateId: string; chunkIds: string[]; score: number }>();

  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  private readonly speech = inject(SpeechService);

  constructor() {
    effect(
      () => {
        this.template();
        this.masteredDone.set(false);
      },
      { allowSignalWrites: true }
    );
  }

  readonly isListening = signal(false);
  readonly feedback = signal<{ score: number; wrongWords: string[] } | null>(null);
  readonly hideText = signal(false);
  readonly productionMode = signal(false);
  readonly showProductionAnswer = signal(false);
  readonly shadowSpeed = signal<'slow' | 'normal' | 'fast'>('normal');
  readonly shadowStep = signal<'idle' | 'listening' | 'done'>('idle');
  readonly shadowScore = signal<number | null>(null);
  readonly shadowSpeeds: { value: 'slow' | 'normal' | 'fast'; label: string }[] = [
    { value: 'slow', label: '🐢 Chậm' },
    { value: 'normal', label: '▶ Normal' },
    { value: 'fast', label: '⚡ Nhanh' },
  ];
  readonly recording = signal(false);
  readonly recordingUrl = signal<string | null>(null);
  readonly ratedLabel = signal<string | null>(null);
  readonly masteredDone = signal(false);
  readonly supported = this.speech.isRecognitionSupported();
  readonly rated = output<{ templateId: string; chunkIds: string[]; rating: ReviewRating }>();

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;

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

  readonly chunkIds = computed(() => {
    const target = this.target();
    return this.content
      .chunks()
      .filter((c) => new RegExp(`\\b${escapeRegex(c.english)}\\b`, 'i').test(target))
      .map((c) => c.id);
  });

  listenSlow(): void {
    this.speech.speak(this.target(), 'en-US');
  }

  toggleShadow(): void {
    this.hideText.set(!this.hideText());
  }

  toggleProductionMode(): void {
    this.productionMode.set(!this.productionMode());
    this.showProductionAnswer.set(false);
  }

  revealProductionAnswer(): void {
    this.showProductionAnswer.set(true);
    this.rate('again');
  }

  setShadowSpeed(speed: 'slow' | 'normal' | 'fast'): void {
    this.shadowSpeed.set(speed);
  }

  playShadow(): void {
    const rate = { slow: 0.7, normal: 1.0, fast: 1.3 }[this.shadowSpeed()];
    this.speech.speak(this.target(), 'en-US', rate);
  }

  async repeatShadow(): Promise<void> {
    if (!this.supported) return;
    this.shadowStep.set('listening');
    this.shadowScore.set(null);
    try {
      const transcript = await this.speech.startListening('en-US');
      const fb = this.engine.scoreSpeech(this.target(), transcript);
      this.shadowScore.set(fb.score);
      this.shadowStep.set('done');
    } catch {
      this.shadowStep.set('idle');
    }
  }

  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.mediaRecorder?.stop();
      return;
    }
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) this.audioChunks.push(evt.data);
      };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.recordingUrl.set(URL.createObjectURL(blob));
        this.recording.set(false);
        this.audioStream?.getTracks().forEach((t) => t.stop());
        this.audioStream = null;
        this.mediaRecorder = null;
      };
      this.mediaRecorder.start();
      this.recording.set(true);
    } catch {
      this.recording.set(false);
    }
  }

  playRecording(): void {
    const url = this.recordingUrl();
    if (!url) return;
    const audio = new Audio(url);
    void audio.play();
  }

  rate(rating: ReviewRating): void {
    const labels: Record<ReviewRating, string> = {
      again: 'Again — sẽ ôn lại hôm nay',
      hard: 'Hard',
      good: 'Good',
      easy: 'Easy',
    };
    this.ratedLabel.set(labels[rating]);
    this.rated.emit({ templateId: this.template().id, chunkIds: this.chunkIds(), rating });
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
    if (this.masteredDone()) return;
    this.masteredDone.set(true);
    this.mastered.emit({ templateId: this.template().id, chunkIds: this.chunkIds(), score: 100 });
    this.feedback.set({ score: 100, wrongWords: [] });
  }

  ngOnDestroy(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.audioStream?.getTracks().forEach((t) => t.stop());
    this.audioStream = null;
    const url = this.recordingUrl();
    if (url) URL.revokeObjectURL(url);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
