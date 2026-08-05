import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { SpeechService } from '../../../core/services/speech.service';

const ROLE_CLASS: Record<string, string> = {
  opener: 'text-blue-700 bg-blue-50',
  linker: 'text-purple-700 bg-purple-50',
  filler: 'text-orange-700 bg-orange-50',
  closer: 'text-green-700 bg-green-50',
};

@Component({
  selector: 'app-sentence-analysis',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200">
      <h3 class="font-semibold text-slate-800">{{ template().english }}</h3>
      <p class="text-sm text-slate-500">{{ template().vietnamese }}</p>
      <div class="mt-4 flex flex-wrap items-center gap-1 text-base leading-relaxed">
        @for (part of parts(); track $index) {
          @if (part.role) {
            <span class="rounded-lg px-1.5 py-0.5 font-medium {{ roleClass(part.role) }}">{{ part.text }}</span>
          } @else {
            <span class="text-slate-700">{{ part.text }}</span>
          }
        }
      </div>
      <div class="mt-3 flex items-center gap-3 text-sm">
        <button (click)="speak()" class="rounded-xl bg-slate-800 px-4 py-1.5 text-white">🔊 Nghe mẫu</button>
        <span class="text-xs text-slate-400">Xanh=opener · Tím=linker · Cam=filler · Lục=closer</span>
      </div>
    </div>
  `,
})
export class SentenceAnalysisComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly speech = inject(SpeechService);

  readonly parts = () => this.engine.annotateStructure(this.template());

  roleClass(role: string | null): string {
    return ROLE_CLASS[role ?? ''] ?? 'text-slate-700';
  }

  speak(): void {
    this.speech.speak(this.template().example.en, 'en-US');
  }
}
