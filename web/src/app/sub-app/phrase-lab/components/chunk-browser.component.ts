import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseChunk } from '../models/phrase.model';
import { ChunkCardComponent } from './chunk-card.component';

@Component({
  selector: 'app-chunk-browser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ChunkCardComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2 text-sm">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Domain</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedDomain()" (ngModelChange)="selectDomain($event)">
            <option value="all">Tất cả</option>
            @for (d of domains(); track d) { <option [value]="d">{{ d }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Context</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedContext()" (ngModelChange)="selectedContext.set($event)">
            <option value="all">Tất cả</option>
            @for (c of contexts(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Level</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedLevel()" (ngModelChange)="selectedLevel.set($event)">
            <option value="all">Tất cả</option>
            @for (l of levels(); track l) { <option [value]="l">{{ l }}</option> }
          </select>
        </label>
      </div>
      <p class="text-xs text-slate-400">{{ filtered().length }} chunk</p>
      <div class="grid gap-3 sm:grid-cols-2">
        @for (chunk of filtered(); track chunk.id) { <app-chunk-card [chunk]="chunk" /> }
      </div>
    </div>
  `,
})
export class ChunkBrowserComponent {
  private readonly content = inject(PhraseContentService);
  readonly domains = this.content.domains;
  readonly contexts = this.content.contexts;
  readonly levels = this.content.levels;
  readonly selectedDomain = signal<string>('all');
  readonly selectedContext = signal<string>('all');
  readonly selectedLevel = signal<string>('all');

  readonly filtered = computed<PhraseChunk[]>(() => {
    const all = this.content.chunks();
    return all.filter(
      (c) =>
        (this.selectedDomain() === 'all' || c.domain === this.selectedDomain()) &&
        (this.selectedContext() === 'all' || c.context === this.selectedContext()) &&
        (this.selectedLevel() === 'all' || c.level === this.selectedLevel())
    );
  });

  selectDomain(d: string): void {
    this.selectedDomain.set(d);
    this.selectedContext.set('all');
  }
}
