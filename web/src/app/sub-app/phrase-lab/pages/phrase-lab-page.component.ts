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
import { DailySessionComponent } from '../components/daily-session.component';
import { ConversationBuilderComponent } from '../components/conversation-builder.component';
import { ResponsePracticeComponent } from '../components/response-practice.component';
import { SpeakingChainComponent } from '../components/speaking-chain.component';

@Component({
  selector: 'app-phrase-lab-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChunkBrowserComponent, SentenceAnalysisComponent, SentenceBuilderComponent, RoleCombinerComponent, OrderArrangeComponent, SpeakPracticeComponent, DailySessionComponent, ConversationBuilderComponent, ResponsePracticeComponent, SpeakingChainComponent],
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

      <div class="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
        <span class="font-semibold text-slate-700">📊 {{ coverage().learned }}/{{ coverage().total }} chunk đã học</span>
        <div class="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div class="h-full rounded-full bg-emerald-400" [style.width.%]="coveragePct()"></div>
        </div>
        <span>{{ coveragePct() }}%</span>
      </div>

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

      @if (activeTab() === 'today') {
        <app-daily-session />
      } @else if (activeTab() === 'conversation') {
        <app-conversation-builder />
      } @else if (activeTab() === 'explore') {
        <app-chunk-browser />
      } @else if (activeTab() === 'response') {
        <app-response-practice />
      } @else if (activeTab() === 'chain') {
        <app-speaking-chain />
      } @else if (activeTab() === 'analysis') {
        <div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <select [value]="selectedDomain()" (change)="selectDomain($any($event.target).value)"
            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="all">Tất cả domain</option>
            @for (d of content.domains(); track d) {
              <option [value]="d">{{ d }}</option>
            }
          </select>
          <select [value]="selectedContext()" (change)="selectContext($any($event.target).value)"
            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="all">Tất cả context</option>
            @for (c of content.contexts(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          <select [value]="selectedLevel()" (change)="selectLevel($any($event.target).value)"
            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="all">Tất cả level</option>
            @for (l of content.levels(); track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </div>
        @if (filteredTemplates().length === 0) {
          <p class="text-sm text-slate-400">Chưa có template cho bộ lọc hiện tại.</p>
        } @else {
          <div class="grid gap-3 sm:grid-cols-2">
            @for (t of filteredTemplates(); track t.id) {
              <app-sentence-analysis [template]="t" />
            }
          </div>
        }
      } @else {
        @if (content.templates().length > 0) {
          <div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <label class="font-medium text-slate-600" for="template-select">Template:</label>
            <select id="template-select"
              class="max-w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
              [value]="selectedTemplate()?.id ?? ''"
              (change)="selectTemplate($any($event.target).value)">
              @for (t of content.templates(); track t.id) {
                <option [value]="t.id">{{ templateLabel(t) }}</option>
              }
            </select>
          </div>
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
    { id: 'today', label: 'Hôm nay' },
    { id: 'conversation', label: 'Hội thoại' },
    { id: 'explore', label: 'Khám phá' },
    { id: 'analysis', label: 'Phân tích' },
    { id: 'slot', label: 'Điền slot' },
    { id: 'role', label: 'Tổ hợp role' },
    { id: 'order', label: 'Xếp thứ tự' },
    { id: 'speak', label: 'Luyện nói' },
    { id: 'response', label: 'Phản xạ' },
    { id: 'chain', label: 'Chuỗi nói' },
  ];
  readonly activeTab = signal<string>('today');
  readonly selectedTemplate = signal<PhraseTemplate | null>(null);
  readonly selectedDomain = signal<string>('all');
  readonly selectedContext = signal<string>('all');
  readonly selectedLevel = signal<string>('all');

  readonly content = inject(PhraseContentService);
  readonly progress = inject(PhraseProgressService);

  readonly filteredTemplates = computed(() =>
    this.content
      .templates()
      .filter(
        (t) =>
          (this.selectedDomain() === 'all' || t.domain === this.selectedDomain()) &&
          (this.selectedContext() === 'all' || t.context === this.selectedContext()) &&
          (this.selectedLevel() === 'all' || t.level === this.selectedLevel())
      )
  );

  readonly coverage = computed(() => {
    const cov = this.progress.getCoverage(this.content.chunks());
    const learned = Object.values(cov).reduce((s, x) => s + x.learned, 0);
    const total = Object.values(cov).reduce((s, x) => s + x.total, 0);
    return { learned, total };
  });

  readonly coveragePct = computed(() => {
    const total = this.coverage().total;
    return total === 0 ? 0 : Math.round((this.coverage().learned / total) * 100);
  });

  ngOnInit(): void {
    void this.content.loadAll();
    void this.progress.init().catch(() => undefined);
  }

  setTab(id: string): void {
    this.activeTab.set(id);
    if (id !== 'explore' && id !== 'today' && id !== 'conversation' && id !== 'response' && id !== 'chain' && id !== 'analysis' && !this.selectedTemplate()) {
      this.selectedTemplate.set(this.content.templates()[0] ?? null);
    }
  }

  selectDomain(value: string): void {
    this.selectedDomain.set(value);
    this.selectedContext.set('all');
  }

  selectContext(value: string): void {
    this.selectedContext.set(value);
  }

  selectLevel(value: string): void {
    this.selectedLevel.set(value);
  }

  selectTemplate(id: string): void {
    const t = this.content.templates().find((x) => x.id === id);
    if (t) this.selectedTemplate.set(t);
  }

  templateLabel(t: PhraseTemplate): string {
    return `${t.domain} · ${t.context} · ${t.level} — ${t.english}`;
  }

  onMastered(evt: { templateId: string; chunkIds: string[]; score: number }): void {
    void this.progress.recordSpeakResult(evt.templateId, evt.chunkIds, evt.score);
  }
}
