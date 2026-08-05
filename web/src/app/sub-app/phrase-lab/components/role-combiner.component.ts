import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';

@Component({
  selector: 'app-role-combiner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Tổ hợp theo vai trò</h3>
      @for (slot of template().slots; track slot.name) {
        @if (slot.role) {
          <fieldset class="space-y-1">
            <legend class="text-xs text-slate-500">{{ slot.name }} · {{ slot.role }}</legend>
            @for (c of candidates(slot.role); track c.id) {
              <button
                (click)="pick(slot.name, c.id)"
                class="block w-full rounded-xl border px-3 py-2 text-left text-sm transition"
                [class.border-slate-800]="selection()[slot.name] === c.id"
                [class.border-slate-200]="selection()[slot.name] !== c.id">
                {{ c.english }} <span class="text-slate-400">— {{ c.vietnamese }}</span>
              </button>
            }
          </fieldset>
        }
      }
      @if (result().errors.length) {
        <ul class="text-sm text-red-600 space-y-1">
          @for (e of result().errors; track e) { <li>⚠ {{ e }}</li> }
        </ul>
      } @else if (result().sentence) {
        <p class="rounded-xl bg-slate-50 p-3 text-slate-800 leading-relaxed">{{ result().sentence }}</p>
      }
    </div>
  `,
})
export class RoleCombinerComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  readonly selection = signal<Record<string, string>>({});

  candidates(role: string) {
    const t = this.template();
    return this.content.chunks().filter((c) => c.role === role && c.domain === t.domain && c.context === t.context && c.level === t.level);
  }

  pick(slotName: string, chunkId: string): void {
    this.selection.update((s) => ({ ...s, [slotName]: chunkId }));
  }

  readonly result = computed(() => this.engine.combineByRole(this.template(), this.content.chunks(), this.selection()));
}
