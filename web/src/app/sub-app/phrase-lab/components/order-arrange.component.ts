import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseEngineService } from '../services/phrase-engine.service';
import { PhraseContentService } from '../services/phrase-content.service';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

@Component({
  selector: 'app-order-arrange',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl bg-white/70 backdrop-blur p-4 border border-slate-200 space-y-4">
      <h3 class="font-semibold text-slate-800">Xếp các chunk theo đúng thứ tự</h3>
      <p class="text-sm text-slate-500 leading-relaxed">
        @for (id of picked(); track id) {
          <span class="mr-1 inline-block rounded-lg bg-slate-100 px-2 py-0.5" [class.bg-red-100]="isWrong($index)">{{ textOf(id) }}</span>
        } @empty { <span class="text-slate-400">Bấm các chunk bên dưới theo thứ tự...</span> }
      </p>
      <div class="flex flex-wrap gap-2">
        @for (item of pool(); track item.id) {
          @if (!picked().includes(item.id)) {
            <button (click)="tap(item.id)" class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm">{{ item.text }}</button>
          }
        }
      </div>
      <div class="flex gap-2">
        <button (click)="check()" class="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">Kiểm tra</button>
        <button (click)="reset()" class="rounded-xl border border-slate-200 px-4 py-2 text-sm">Làm lại</button>
      </div>
      @if (verdict()) {
        <p class="text-sm font-medium" [class.text-emerald-600]="verdict()!.correct" [class.text-red-600]="!verdict()!.correct">
          {{ verdict()!.correct ? 'Chính xác! 🎉' : 'Sai thứ tự — xem lại các vị trí đỏ.' }}
        </p>
      }
    </div>
  `,
})
export class OrderArrangeComponent {
  readonly template = input.required<PhraseTemplate>();
  private readonly engine = inject(PhraseEngineService);
  private readonly content = inject(PhraseContentService);
  readonly picked = signal<string[]>([]);
  readonly verdict = signal<{ correct: boolean; positionErrors: number[] } | null>(null);
  private readonly sequence = computed(() => this.engine.expectedSequence(this.template(), this.content.chunks()));

  readonly pool = computed(() => shuffled(this.sequence().map((text, i) => ({ id: `${i}:${text}`, text }))));

  private readonly textById = computed(() => new Map(this.pool().map((item) => [item.id, item.text])));

  textOf(id: string): string {
    return this.textById().get(id) ?? '';
  }

  tap(id: string): void {
    this.picked.update((p) => [...p, id]);
  }

  check(): void {
    this.verdict.set(this.engine.validateOrder(this.template(), this.content.chunks(), this.picked().map((id) => this.textOf(id))));
  }

  isWrong(index: number): boolean {
    return this.verdict()?.positionErrors.includes(index) ?? false;
  }

  reset(): void {
    this.picked.set([]);
    this.verdict.set(null);
  }
}
