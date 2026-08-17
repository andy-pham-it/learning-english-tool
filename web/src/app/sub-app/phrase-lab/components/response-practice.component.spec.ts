import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ResponsePracticeComponent } from './response-practice.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { ScenarioService } from '../services/scenario.service';
import { SpeechService } from '../../../core/services/speech.service';
import type { PhraseChunk } from '../models/phrase.model';
import type { Scenario } from '../models/scenario.model';

describe('ResponsePracticeComponent', () => {
  let fixture: ComponentFixture<ResponsePracticeComponent>;
  let progressStub: jasmine.SpyObj<PhraseProgressService>;
  let speechStub: { speak: jasmine.Spy };

  const chunk = (id: string): PhraseChunk => ({
    id,
    domain: 'it',
    context: 'meeting',
    level: 'A2',
    english: `chunk ${id}`,
    vietnamese: 'nghĩa',
    phonetic: '',
    role: 'opener',
    examples: [],
  });

  const scenario = (): Scenario => ({
    id: 'scn-1',
    level: 'A2',
    context: 'meeting',
    title: 'Cuộc họp',
    turns: [
      {
        speakerLine: 'Shall we start?',
        answers: [{ ids: ['a1', 'a2'] }, { ids: ['a1'] }],
        replyLine: 'Great!',
      },
      {
        speakerLine: 'Anything else?',
        answers: [{ ids: ['a3'] }],
        replyLine: 'Thanks!',
      },
    ],
  });

  const chunks = [chunk('a1'), chunk('a2'), chunk('a3'), chunk('dis1')];

  beforeEach(() => {
    progressStub = jasmine.createSpyObj('PhraseProgressService', ['reviewChunk']);
    (progressStub as unknown as { progress: unknown }).progress = signal(null);
    speechStub = { speak: jasmine.createSpy('speak') };
    TestBed.configureTestingModule({
      imports: [ResponsePracticeComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal(chunks),
            templates: signal([]),
            loadAll: jasmine.createSpy(),
            offline: signal(false),
          },
        },
        { provide: PhraseProgressService, useValue: progressStub },
        {
          provide: ScenarioService,
          useValue: {
            scenarios: signal([scenario()]),
            loading: signal(false),
            offline: signal(false),
            loadScenarios: jasmine.createSpy().and.resolveTo([scenario()]),
          },
        },
        { provide: SpeechService, useValue: speechStub },
      ],
    });
    fixture = TestBed.createComponent(ResponsePracticeComponent);
    fixture.detectChanges();
  });

  it('hiện màn hình bắt đầu với nút Bắt đầu', () => {
    expect(fixture.nativeElement.textContent).toContain('Bắt đầu');
  });

  it('start() chọn scenario và xây pool cho lượt 1', () => {
    fixture.componentInstance.start();
    fixture.detectChanges();
    expect(fixture.componentInstance.scenario()?.id).toBe('scn-1');
    const ids = fixture.componentInstance.pool().map((o) => o.id);
    expect(ids).toContain('a1');
    expect(ids).toContain('a2');
    expect(fixture.nativeElement.textContent).toContain('Shall we start?');
  });

  it('toggleChip thêm và bỏ chunk khỏi selectedIds', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a1');
    expect(fixture.componentInstance.selectedIds()).toEqual(['a1']);
    fixture.componentInstance.toggleChip('a1');
    expect(fixture.componentInstance.selectedIds()).toEqual([]);
  });

  it('check() đúng -> reviewChunk good cho chunk đã chọn + replyLine', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a1');
    fixture.componentInstance.toggleChip('a2');
    fixture.componentInstance.check();
    fixture.detectChanges();
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a1', 'good');
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a2', 'good');
    expect(fixture.nativeElement.textContent).toContain('Great!');
    expect(fixture.nativeElement.textContent).toContain('Tiếp tục');
  });

  it('check() sai -> không review, tăng wrongStreak, không tiến', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a3');
    fixture.componentInstance.check();
    fixture.detectChanges();
    expect(progressStub.reviewChunk).not.toHaveBeenCalled();
    expect(fixture.componentInstance.wrongStreak()).toBe(1);
    expect(fixture.componentInstance.turnIndex()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Chưa đúng');
  });

  it('sau 2 lần sai liên tiếp -> Xem đáp án xuất hiện', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a3');
    fixture.componentInstance.check();
    fixture.componentInstance.check(); // lần sai 2 — selection giữ nguyên sau lần sai 1
    fixture.detectChanges();
    expect(fixture.componentInstance.wrongStreak()).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Xem đáp án');
  });

  it('revealAnswer -> reviewChunk again cho answers[0], tiến lượt', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a3');
    fixture.componentInstance.check();
    fixture.componentInstance.check();
    fixture.componentInstance.revealAnswer();
    fixture.detectChanges();
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a1', 'again');
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a2', 'again');
    expect(fixture.nativeElement.textContent).toContain('Đáp án tham khảo');
    expect(fixture.nativeElement.textContent).toContain('Tiếp tục');
  });

  it('next() qua lượt cuối -> summary', () => {
    fixture.componentInstance.start();
    // lượt 1 đúng
    fixture.componentInstance.toggleChip('a1');
    fixture.componentInstance.toggleChip('a2');
    fixture.componentInstance.check();
    fixture.componentInstance.next();
    // lượt 2 đúng
    fixture.componentInstance.toggleChip('a3');
    fixture.componentInstance.check();
    fixture.componentInstance.next();
    fixture.detectChanges();
    expect(fixture.componentInstance.phase()).toBe('summary');
    expect(fixture.nativeElement.textContent).toContain('Hoàn tất');
  });

  it('Xoá hết làm trống selectedIds', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a1');
    fixture.componentInstance.clearSelection();
    expect(fixture.componentInstance.selectedIds()).toEqual([]);
  });

  it('check() đúng -> chỉ review một lần (guard chống spam)', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a1');
    fixture.componentInstance.toggleChip('a2');
    fixture.componentInstance.check();
    fixture.componentInstance.check();
    expect(progressStub.reviewChunk.calls.count()).toBe(2); // a1 + a2, not 4
  });

  it('revealAnswer -> review again cho chunk user chọn sai + answers[0]', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a3');
    fixture.componentInstance.check(); // sai lần 1
    fixture.componentInstance.check(); // sai lần 2 -> canReveal
    fixture.componentInstance.revealAnswer();
    fixture.componentInstance.revealAnswer(); // spam -> không review lại
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a3', 'again');
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a1', 'again');
    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a2', 'again');
  });

  it('revealAnswer đặt revealed=true để ẩn nút Xem đáp án', () => {
    fixture.componentInstance.start();
    fixture.componentInstance.toggleChip('a3');
    fixture.componentInstance.check();
    fixture.componentInstance.check();
    fixture.componentInstance.revealAnswer();
    expect(fixture.componentInstance.revealed()).toBeTrue();
  });
});
