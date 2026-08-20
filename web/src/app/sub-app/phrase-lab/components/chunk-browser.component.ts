import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseChunk } from '../models/phrase.model';
import { ChunkCardComponent } from './chunk-card.component';
import { PageChangeEvent, PaginationComponent } from '../../../shared/ui/pagination.component';

@Component({
  selector: 'app-chunk-browser',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ChunkCardComponent, PaginationComponent],
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
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedContext()" (ngModelChange)="selectContext($event)">
            <option value="all">Tất cả</option>
            @for (c of contexts(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-slate-500">Level</span>
          <select class="rounded-xl border border-slate-200 bg-white px-3 py-1.5" [ngModel]="selectedLevel()" (ngModelChange)="selectLevel($event)">
            <option value="all">Tất cả</option>
            @for (l of levels(); track l) { <option [value]="l">{{ l }}</option> }
          </select>
        </label>
      </div>
      <p class="text-xs text-slate-400">{{ filtered().length }} chunk</p>
      @if (filtered().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-slate-500">
          Chưa có từ vựng nào phù hợp bộ lọc.
        </div>
      }
      <div class="grid gap-3 sm:grid-cols-2">
        @for (chunk of pagedChunks(); track chunk.id) { <app-chunk-card [chunk]="chunk" /> }
      </div>
      @if (filtered().length > pageSize()) {
        <app-pagination [totalItems]="filtered().length" [pageSize]="pageSize()" (pageChange)="onPageChange($event)" />
      }
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
  readonly page = signal(1);
  readonly pageSize = signal(20);

  readonly filtered = computed<PhraseChunk[]>(() => {
    const all = this.content.chunks();
    return all.filter(
      (c) =>
        (this.selectedDomain() === 'all' || c.domain === this.selectedDomain()) &&
        (this.selectedContext() === 'all' || c.context === this.selectedContext()) &&
        (this.selectedLevel() === 'all' || c.level === this.selectedLevel())
    );
  });

  readonly pagedChunks = computed(() => {
    const f = this.filtered();
    return f.slice((this.page() - 1) * this.pageSize(), this.page() * this.pageSize());
  });

  onPageChange(e: PageChangeEvent): void {
    this.page.set(e.page);
    this.pageSize.set(e.pageSize);
  }

  selectDomain(d: string): void {
    this.selectedDomain.set(d);
    this.selectedContext.set('all');
    this.page.set(1);
  }

  selectContext(c: string): void {
    this.selectedContext.set(c);
    this.page.set(1);
  }

  selectLevel(l: string): void {
    this.selectedLevel.set(l);
    this.page.set(1);
  }
}