import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';

@Component({
  selector: 'app-sentence-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Điền slot để tạo câu</h3>
      @for (slot of template().slots; track slot.name) {
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-xs text-slate-500">{{ slot.name }} {{ slot.role ? '· ' + slot.role : '' }}</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-2" [ngModel]="values()[slot.name]" (ngModelChange)="set(slot.name, $event)">
            @if (!slot.role) {
              @for (opt of slot.options ?? []; track opt) { <option [value]="opt">{{ opt }}</option> }
            } @else {
              @for (c of optionsFor(slot.name); track c.id) { <option [value]="c.english">{{ c.english }} — {{ c.vietnamese }}</option> }
            }
          </select>
        </label>
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

  optionsFor(slotName: string) {
    const t = this.template();
    return this.content
      .chunks()
      .filter(
        (c) => c.role === t.slots.find((s) => s.name === slotName)?.role && c.domain === t.domain && c.context === t.context && c.level === t.level
      );
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
