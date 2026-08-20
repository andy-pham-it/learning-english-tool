import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

export interface PageChangeEvent { page: number; pageSize: number; }

@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <button data-test="first" (click)="first()" [disabled]="page() === 1"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">«</button>
      <button data-test="prev" (click)="prev()" [disabled]="page() === 1"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">‹</button>
      @for (p of visiblePages(); track p) {
        @if (p === '…') {
          <span class="px-1 text-slate-400">…</span>
        } @else {
          <button (click)="goToPage(p)"
            [class]="p === page()
              ? 'rounded-lg bg-slate-800 px-2.5 py-1.5 font-semibold text-white'
              : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50'">{{ p }}</button>
        }
      }
      <button data-test="next" (click)="next()" [disabled]="page() >= totalPages()"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">›</button>
      <button data-test="last" (click)="last()" [disabled]="page() >= totalPages()"
        class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">»</button>
      <span class="text-slate-400">{{ from() }}–{{ to() }} / {{ totalItems() }}</span>
      <select #sizeSelect (change)="onSizeChange(+sizeSelect.value)" [value]="size()"
        class="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        @for (s of pageSizeOptions(); track s) { <option [value]="s">{{ s }} / trang</option> }
      </select>
    </div>
  `,
})
export class PaginationComponent {
  readonly totalItems = input(0);
  readonly pageSize = input(20);
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);
  readonly pageChange = output<PageChangeEvent>();

  readonly page = signal(1);
  readonly size = signal(20);

  constructor() {
    effect(() => {
      this.size.set(this.pageSize());
      this.page.set(1);
    }, { allowSignalWrites: true });
  }

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.size())));
  readonly from = computed(() => (this.totalItems() === 0 ? 0 : (this.page() - 1) * this.size() + 1));
  readonly to = computed(() => Math.min(this.page() * this.size(), this.totalItems()));

  readonly visiblePages = computed<Array<number | '…'>>(() => {
    const t = this.totalPages();
    const c = this.page();
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set<number>([1, 2, t - 1, t, c]);
    for (let i = Math.max(3, c - 1); i <= Math.min(t - 2, c + 1); i++) set.add(i);
    const sorted = Array.from(set).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  });

  goToPage(p: number): void {
    const next = Math.max(1, Math.min(p, this.totalPages()));
    if (next === this.page()) return;
    this.page.set(next);
    this.pageChange.emit({ page: next, pageSize: this.size() });
  }
  first(): void { this.goToPage(1); }
  last(): void { this.goToPage(this.totalPages()); }
  prev(): void { this.goToPage(this.page() - 1); }
  next(): void { this.goToPage(this.page() + 1); }
  onSizeChange(s: number): void {
    this.size.set(s);
    this.page.set(1);
    this.pageChange.emit({ page: 1, pageSize: s });
  }
}
