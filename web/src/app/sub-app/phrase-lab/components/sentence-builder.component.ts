import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';

@Component({
  selector: 'app-sentence-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Điền slot để tạo câu</h3>
      <p class="text-sm text-slate-500">Chọn 1 lựa chọn cho mỗi chỗ trống để ghép câu hoàn chỉnh.</p>
      @for (slot of template().slots; track slot.name) {
        <fieldset class="space-y-1">
          <legend class="text-xs font-semibold text-slate-500">{{ slot.name }}{{ slot.role ? ' · ' + slot.role : '' }}</legend>
          @for (opt of optionsFor(slot.name); track opt.english) {
            <button
              (click)="set(slot.name, opt.english)"
              class="block w-full rounded-xl border px-3 py-2 text-left text-sm transition"
              [class.border-slate-800]="values()[slot.name] === opt.english"
              [class.border-slate-200]="values()[slot.name] !== opt.english">
              {{ opt.english }}@if (opt.vietnamese) { <span class="text-slate-400">{{ ' — ' + opt.vietnamese }}</span> }
            </button>
          }
        </fieldset>
      }
      <div class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ preview() }}</div>
      <button (click)="speak()" class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">🔊 Nghe câu</button>
    </div>
  `,
})
export class SentenceBuilderComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  private readonly speech = inject(SpeechService);
  readonly values = signal<Record<string, string>>({});

  optionsFor(slotName: string): { english: string; vietnamese: string }[] {
    const t = this.template();
    const slot = t.slots.find((s) => s.name === slotName);
    if (!slot) return [];
    if (!slot.role) {
      return (slot.options ?? []).map((opt) => ({ english: opt, vietnamese: '' }));
    }
    return this.content
      .chunks()
      .filter(
        (c) => c.role === slot.role && c.domain === t.domain && c.context === t.context && c.level === t.level
      )
      .map((c) => ({ english: c.english, vietnamese: c.vietnamese }));
  }

  set(name: string, value: string): void {
    this.values.update((v) => ({ ...v, [name]: value }));
  }

  readonly preview = computed<string>(() => {
    const t = this.template();
    const fills = t.slots.map((s) => {
      const chosen = this.values()[s.name];
      if (chosen) return { name: s.name, value: chosen };
      return { name: s.name, value: s.role ? (this.optionsFor(s.name)[0]?.english ?? '___') : (s.options?.[0] ?? '___') };
    });
    return this.engine.buildSentence(t, fills);
  });

  speak(): void {
    this.speech.speak(this.preview(), 'en-US');
  }
}
