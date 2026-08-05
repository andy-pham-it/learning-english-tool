import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { PhraseTemplate } from '../models/phrase.model';
import { ChunkBrowserComponent } from '../components/chunk-browser.component';
import { SentenceAnalysisComponent } from '../components/sentence-analysis.component';
import { SentenceBuilderComponent } from '../components/sentence-builder.component';
import { RoleCombinerComponent } from '../components/role-combiner.component';
import { OrderArrangeComponent } from '../components/order-arrange.component';
import { SpeakPracticeComponent } from '../components/speak-practice.component';

@Component({
  selector: 'app-phrase-lab-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChunkBrowserComponent, SentenceAnalysisComponent, SentenceBuilderComponent, RoleCombinerComponent, OrderArrangeComponent, SpeakPracticeComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <header class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-slate-800">Phrase Lab</h1>
        <span class="rounded-full px-3 py-1 text-xs font-medium"
          [class.bg-emerald-100]="progress.authed()" [class.text-emerald-700]="progress.authed()"
          [class.bg-slate-200]="!progress.authed()" [class.text-slate-600]="!progress.authed()">
          {{ progress.authed() ? 'Đồng bộ Firestore' : 'Lưu local' }}
        </span>
      </header>

      @if (content.offline()) {
        <div class="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">Mất kết nối — đang dùng dữ liệu đã lưu.</div>
      }

      <div class="mb-4 flex flex-wrap gap-2 text-sm">
        @for (tab of tabs; track tab.id) {
          <button (click)="setTab(tab.id)"
            class="rounded-xl px-3 py-1.5 font-medium transition"
            [class.bg-slate-800]="activeTab() === tab.id" [class.text-white]="activeTab() === tab.id"
            [class.bg-white]="activeTab() !== tab.id" [class.text-slate-600]="activeTab() !== tab.id">
            {{ tab.label }}
          </button>
        }
      </div>

      @if (activeTab() === 'explore') {
        <app-chunk-browser />
      } @else {
        @if (activeTab() === 'analysis' && selectedTemplate(); as t) {
          <app-sentence-analysis [template]="t" />
        }
        @if (activeTab() === 'slot' && selectedTemplate(); as t) {
          <app-sentence-builder [template]="t" />
        }
        @if (activeTab() === 'role' && selectedTemplate(); as t) {
          <app-role-combiner [template]="t" />
        }
        @if (activeTab() === 'order' && selectedTemplate(); as t) {
          <app-order-arrange [template]="t" />
        }
        @if (activeTab() === 'speak' && selectedTemplate(); as t) {
          <app-speak-practice [template]="t" (mastered)="onMastered($event)" />
        }
        @if (!selectedTemplate()) {
          <p class="text-sm text-slate-400">Chưa có template cho bộ lọc hiện tại.</p>
        }
      }
    </div>
  `,
})
export class PhraseLabPageComponent implements OnInit {
  readonly tabs = [
    { id: 'explore', label: 'Khám phá' },
    { id: 'analysis', label: 'Phân tích' },
    { id: 'slot', label: 'Điền slot' },
    { id: 'role', label: 'Tổ hợp role' },
    { id: 'order', label: 'Xếp thứ tự' },
    { id: 'speak', label: 'Luyện nói' },
  ];
  readonly activeTab = signal<string>('explore');
  readonly selectedTemplate = signal<PhraseTemplate | null>(null);

  readonly content = inject(PhraseContentService);
  readonly progress = inject(PhraseProgressService);

  ngOnInit(): void {
    void this.content.loadAll();
    void this.progress.init().catch(() => undefined);
  }

  setTab(id: string): void {
    this.activeTab.set(id);
    if (id !== 'explore' && !this.selectedTemplate()) {
      this.selectedTemplate.set(this.content.templates()[0] ?? null);
    }
  }

  onMastered(evt: { templateId: string; chunkIds: string[]; score: number }): void {
    void this.progress.recordSpeakResult(evt.templateId, evt.chunkIds, evt.score);
  }
}
