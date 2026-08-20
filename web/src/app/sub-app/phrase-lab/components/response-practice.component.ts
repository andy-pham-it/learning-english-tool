import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { ScenarioService } from '../services/scenario.service';
import { SpeechService } from '../../../core/services/speech.service';
import { buildTurnPool, checkAnswer, pickScenario, type ChunkOption } from '../engine/scenario-engine';
import type { Level } from '../models/phrase.model';
import type { Scenario } from '../models/scenario.model';

type Phase = 'start' | 'turn' | 'summary';

interface TurnResult {
  firstTry: boolean;
  wrongChunkIds: string[];
}

@Component({
  selector: 'app-response-practice',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (phase() === 'start') {
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-lg font-semibold text-slate-800">Phản xạ giao tiếp</h3>
        <p class="mt-1 text-sm text-slate-500">
          Nghe câu thoại, ghép chunk để trả lời. Chunk dùng sai sẽ về vòng ôn.
        </p>
        @if (scenariosSvc.scenarios().length === 0 && !scenariosSvc.loading() && !scenariosSvc.offline()) {
          <div class="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
            <p class="text-slate-600">Chưa có kịch bản nào để luyện tập phản xạ.</p>
            <p class="mt-1 text-sm text-slate-400">Hãy ghé tab Khám phá để học thêm cụm từ — kịch bản sẽ xuất hiện ở đây sau khi có nội dung.</p>
          </div>
        }
        @if (scenariosSvc.loading()) {
          <p class="mt-3 text-sm text-slate-400">Đang tải kịch bản…</p>
        }
        <div class="mt-3 flex flex-wrap gap-2">
          @for (lv of levelOptions; track lv) {
            <button
              type="button"
              (click)="selectedLevel.set(lv)"
              class="rounded-full px-3 py-1 text-xs font-medium transition"
              [class.bg-indigo-600]="selectedLevel() === lv"
              [class.text-white]="selectedLevel() === lv"
              [class.bg-slate-100]="selectedLevel() !== lv"
              [class.text-slate-700]="selectedLevel() !== lv"
            >{{ lv === 'all' ? 'Tất cả' : lv }}</button>
          }
        </div>
        <button
          type="button"
          (click)="start()"
          class="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >Bắt đầu</button>
        @if (scenariosSvc.offline()) {
          <p class="mt-3 text-sm text-amber-700">Cần kết nối mạng lần đầu.</p>
        }
      </div>
    } @else if (phase() === 'turn') {
      @if (currentTurn(); as turn) {
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-xs text-slate-400">
            {{ scenario()?.title }} · Lượt {{ turnIndex() + 1 }}/{{ scenario()?.turns?.length }}
          </p>
          <div class="mt-2 rounded-2xl bg-slate-100 px-4 py-3">
            <p class="text-slate-800">{{ turn.speakerLine }}</p>
            <div class="mt-1 flex gap-3 text-xs">
              <button type="button" (click)="play(turn.speakerLine)" class="text-indigo-600">🔊 Nghe</button>
              @if (turn.speakerLineVi) {
                <button type="button" (click)="showVi.set(!showVi())" class="text-slate-500">Nghĩa</button>
              }
            </div>
            @if (showVi() && turn.speakerLineVi) {
              <p class="mt-1 text-sm text-slate-500">{{ turn.speakerLineVi }}</p>
            }
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            @for (opt of pool(); track opt.id) {
              <button
                type="button"
                (click)="toggleChip(opt.id)"
                class="rounded-xl border px-3 py-1.5 text-sm transition"
                [class.border-indigo-500]="selectedIds().includes(opt.id)"
                [class.bg-indigo-50]="selectedIds().includes(opt.id)"
                [class.border-slate-200]="!selectedIds().includes(opt.id)"
              >{{ opt.english }}</button>
            }
          </div>
          <div class="mt-3 min-h-10 rounded-xl bg-slate-50 px-3 py-2">
            @if (selectedIds().length === 0) {
              <p class="text-xs text-slate-400">Chọn chunk để ghép câu trả lời…</p>
            } @else {
              <div class="flex flex-wrap gap-1.5">
                @for (id of selectedIds(); track $index) {
                  <span class="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white">
                    {{ chunkText(id) }}
                    <button type="button" (click)="toggleChip(id)" class="ml-1 font-bold">×</button>
                  </span>
                }
              </div>
            }
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              (click)="check()"
              [disabled]="!canCheck() || checked()"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >Kiểm tra</button>
            <button
              type="button"
              (click)="clearSelection()"
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >Xoá hết</button>
            @if (canReveal() && !revealed()) {
              <button
                type="button"
                (click)="revealAnswer()"
                class="rounded-xl border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
              >Xem đáp án</button>
            }
          </div>
          @if (message()) {
            <p class="mt-2 text-sm" [class.text-green-600]="showReply()" [class.text-rose-600]="!showReply() && !showAnswer()" [class.text-amber-700]="showAnswer()">
              {{ message() }}
            </p>
          }
          @if (showReply() && turn.replyLine) {
            <div class="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p class="text-sm text-emerald-900">{{ turn.replyLine }}</p>
              @if (turn.replyLineVi) { <p class="mt-1 text-xs text-emerald-700">{{ turn.replyLineVi }}</p> }
            </div>
          }
          @if (showAnswer() && turn.answers[0]) {
            <div class="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p class="text-xs font-semibold text-amber-700">Đáp án tham khảo</p>
              <p class="mt-1 text-sm text-amber-900">{{ answerText(turn.answers[0].ids) }}</p>
            </div>
          }
          @if (showReply() || showAnswer()) {
            <button
              type="button"
              (click)="next()"
              class="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >Tiếp tục</button>
          }
        </div>
      }
    } @else {
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-lg font-semibold text-slate-800">Kết quả</h3>
        <p class="mt-2 text-sm text-slate-600">
          Trả lời đúng ngay: {{ correctCount() }}/{{ scenario()?.turns?.length ?? 0 }}
        </p>
        @if (wrongChunks().length > 0) {
          <p class="mt-2 text-xs text-slate-500">Chunk cần ôn lại:</p>
          <ul class="mt-1 list-inside list-disc text-sm text-slate-700">
            @for (id of wrongChunks(); track id) {
              <li>{{ chunkText(id) }}</li>
            }
          </ul>
        }
        <button
          type="button"
          (click)="finish()"
          class="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >Hoàn tất</button>
      </div>
    }
  `,
})
export class ResponsePracticeComponent {
  readonly scenariosSvc = inject(ScenarioService);
  private readonly content = inject(PhraseContentService);
  private readonly progress = inject(PhraseProgressService);
  private readonly speech = inject(SpeechService);

  readonly levelOptions: Array<Level | 'all'> = ['all', 'A2', 'B1', 'B2', 'C1'];

  readonly phase = signal<Phase>('start');
  readonly selectedLevel = signal<Level | 'all'>('all');
  readonly scenario = signal<Scenario | null>(null);
  readonly turnIndex = signal(0);
  readonly pool = signal<ChunkOption[]>([]);
  readonly selectedIds = signal<string[]>([]);
  readonly wrongStreak = signal(0);
  readonly showVi = signal(false);
  readonly showReply = signal(false);
  readonly showAnswer = signal(false);
  readonly message = signal('');
  readonly turnResults = signal<TurnResult[]>([]);
  readonly checked = signal(false);
  readonly revealed = signal(false);

  readonly chunkMap = computed(() => new Map(this.content.chunks().map((c) => [c.id, c])));
  readonly currentTurn = computed(() => this.scenario()?.turns[this.turnIndex()] ?? null);
  readonly canCheck = computed(() => this.selectedIds().length > 0);
  readonly canReveal = computed(() => this.wrongStreak() >= 2);
  readonly correctCount = computed(() => this.turnResults().filter((r) => r.firstTry).length);
  readonly wrongChunks = computed(() => [...new Set(this.turnResults().flatMap((r) => r.wrongChunkIds))]);

  constructor() {
    void this.scenariosSvc.loadScenarios();
    void this.content.loadAll();
  }

  start(): void {
    const level = this.selectedLevel();
    const sc = pickScenario(this.scenariosSvc.scenarios(), level === 'all' ? undefined : { level });
    if (!sc) {
      this.message.set('Chưa có scenario phù hợp. Kiểm tra kết nối mạng.');
      return;
    }
    this.scenario.set(sc);
    this.turnIndex.set(0);
    this.turnResults.set([]);
    this.selectedIds.set([]);
    this.wrongStreak.set(0);
    this.checked.set(false);
    this.revealed.set(false);
    this.showVi.set(false);
    this.showReply.set(false);
    this.showAnswer.set(false);
    this.message.set('');
    this.pool.set(buildTurnPool(sc.turns[0], this.chunkMap()));
    this.phase.set('turn');
  }

  toggleChip(id: string): void {
    this.selectedIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  clearSelection(): void {
    this.selectedIds.set([]);
  }

  check(): void {
    const turn = this.currentTurn();
    if (!turn || this.selectedIds().length === 0) return;
    if (this.checked()) return;
    const res = checkAnswer(this.selectedIds(), turn);
    if (res.correct) {
      this.checked.set(true);
      this.turnResults.update((rs) => [...rs, { firstTry: this.wrongStreak() === 0, wrongChunkIds: [] }]);
      for (const id of this.selectedIds()) {
        void this.progress.reviewChunk(id, 'good');
      }
      this.showReply.set(true);
      this.message.set('Đúng!');
    } else {
      this.wrongStreak.update((s) => s + 1);
      this.message.set(this.wrongStreak() >= 2 ? 'Chưa đúng. Bạn có thể xem đáp án.' : 'Chưa đúng, thử lại.');
    }
  }

  revealAnswer(): void {
    const turn = this.currentTurn();
    if (!turn) return;
    if (this.revealed()) return;
    this.revealed.set(true);
    const selected = this.selectedIds();
    const best = turn.answers[0]?.ids ?? [];
    this.turnResults.update((rs) => [...rs, { firstTry: false, wrongChunkIds: [...selected, ...best] }]);
    for (const id of new Set([...selected, ...best])) {
      void this.progress.reviewChunk(id, 'again');
    }
    this.showAnswer.set(true);
    this.message.set('Chưa đúng. Đây là đáp án tham khảo.');
  }

  next(): void {
    const sc = this.scenario();
    if (!sc) return;
    const nextIndex = this.turnIndex() + 1;
    if (nextIndex >= sc.turns.length) {
      this.phase.set('summary');
      return;
    }
    this.turnIndex.set(nextIndex);
    this.selectedIds.set([]);
    this.wrongStreak.set(0);
    this.checked.set(false);
    this.revealed.set(false);
    this.showVi.set(false);
    this.showReply.set(false);
    this.showAnswer.set(false);
    this.message.set('');
    this.pool.set(buildTurnPool(sc.turns[nextIndex], this.chunkMap()));
  }

  finish(): void {
    this.scenario.set(null);
    this.turnIndex.set(0);
    this.turnResults.set([]);
    this.phase.set('start');
  }

  play(text: string): void {
    this.speech.speak(text, 'en-US');
  }

  chunkText(id: string): string {
    return this.chunkMap().get(id)?.english ?? id;
  }

  answerText(ids: string[]): string {
    return ids.map((id) => this.chunkText(id)).join(' ');
  }
}
