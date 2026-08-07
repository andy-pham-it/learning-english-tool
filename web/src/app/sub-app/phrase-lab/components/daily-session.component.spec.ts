import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DailySessionComponent } from './daily-session.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';
import { Level, PhraseChunk, Role } from '../models/phrase.model';

function chunk(id: string, ctx = 'meeting', role: Role = 'opener', level: Level = 'A2'): PhraseChunk {
  return {
    id,
    domain: 'it',
    context: ctx,
    level,
    english: `English ${id}`,
    vietnamese: `Tiếng Việt ${id}`,
    phonetic: '/test/',
    role,
    examples: [],
  };
}

function emptyProgress() {
  return {
    uid: 'local',
    masteredChunks: {},
    masteredTemplates: {},
    reviews: {},
    streak: { current: 0, lastDay: '' },
    totalPoints: 0,
  };
}

describe('DailySessionComponent', () => {
  let fixture: ComponentFixture<DailySessionComponent>;
  let comp: DailySessionComponent;
  let chunks: ReturnType<typeof signal<PhraseChunk[]>>;
  let progressStub: any;
  let speechStub: any;

  beforeEach(() => {
    chunks = signal<PhraseChunk[]>([]);
    progressStub = jasmine.createSpyObj('PhraseProgressService', [
      'getDueChunks',
      'getCoverage',
      'reviewChunk',
    ]);
    progressStub.getDueChunks.and.returnValue([]);
    progressStub.getCoverage.and.returnValue({});
    progressStub.reviewChunk.and.resolveTo();
    progressStub.progress = signal(null);

    speechStub = {
      speak: jasmine.createSpy('speak'),
      isRecognitionSupported: () => false,
      startListening: jasmine.createSpy('startListening'),
    };

    TestBed.configureTestingModule({
      imports: [DailySessionComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks,
            templates: signal([]),
            loadAll: jasmine.createSpy('loadAll'),
            offline: signal(false),
          },
        },
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: SpeechService, useValue: speechStub },
      ],
    });

    fixture = TestBed.createComponent(DailySessionComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  async function rebuild(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('builds queue with due chunks first then new chunks', async () => {
    chunks.set([chunk('b1'), chunk('a1')]);
    progressStub.getDueChunks.and.returnValue(['a1']);
    progressStub.getCoverage.and.returnValue({ meeting: { learned: 0, total: 2 } });
    progressStub.progress.set(emptyProgress());
    await rebuild();

    expect(comp.sessionQueue().length).toBe(2);
    expect(comp.sessionQueue()[0].id).toBe('a1');
    expect(comp.sessionQueue()[1].id).toBe('b1');
    expect(comp.current()!.id).toBe('a1');
    expect(comp.isNew()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('English a1');
  });

  it('rate(good) calls reviewChunk and advances to the next chunk', async () => {
    chunks.set([chunk('a1'), chunk('b1')]);
    progressStub.getDueChunks.and.returnValue(['a1']);
    progressStub.getCoverage.and.returnValue({ meeting: { learned: 0, total: 2 } });
    progressStub.progress.set(emptyProgress());
    await rebuild();

    await comp.rate('good');

    expect(progressStub.reviewChunk).toHaveBeenCalledWith('a1', 'good');
    expect(comp.rated()).toBe(1);
    expect(comp.index()).toBe(1);
    expect(comp.current()!.id).toBe('b1');
    expect(comp.isNew()).toBeTrue();
  });

  it('shows completion screen when the queue is exhausted', async () => {
    chunks.set([chunk('only')]);
    progressStub.getDueChunks.and.returnValue(['only']);
    progressStub.getCoverage.and.returnValue({});
    progressStub.progress.set(emptyProgress());
    await rebuild();

    await comp.rate('easy');

    expect(comp.done()).toBeTrue();
    expect(comp.rated()).toBe(1);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hoàn thành phiên hôm nay!');
    expect(text).toContain('Làm lại');
  });

  it('restart() resets the session and rebuilds the queue', async () => {
    chunks.set([chunk('a1'), chunk('b1')]);
    progressStub.getDueChunks.and.returnValue(['a1']);
    progressStub.getCoverage.and.returnValue({ meeting: { learned: 0, total: 2 } });
    progressStub.progress.set(emptyProgress());
    await rebuild();

    await comp.rate('good');
    expect(comp.index()).toBe(1);

    comp.restart();

    expect(comp.index()).toBe(0);
    expect(comp.done()).toBeFalse();
    expect(comp.rated()).toBe(0);
    expect(comp.sessionQueue().length).toBe(2);
    expect(comp.current()!.id).toBe('a1');
  });

  it('shows empty state when nothing is due and nothing is new', async () => {
    chunks.set([chunk('x1')]);
    progressStub.getDueChunks.and.returnValue([]);
    progressStub.getCoverage.and.returnValue({ meeting: { learned: 1, total: 1 } });
    progressStub.progress.set({
      ...emptyProgress(),
      reviews: { x1: { ease: 2.5, interval: 3, reps: 2, lapses: 0, due: 1 } },
      masteredChunks: { x1: { status: 'mastered', speakScore: 90, lastPracticed: 1 } },
    });
    await rebuild();

    expect(comp.sessionQueue().length).toBe(0);
    expect(comp.current()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Chưa có chunk cần ôn hôm nay');
  });

  it('caps new chunks at 5', async () => {
    chunks.set(Array.from({ length: 8 }, (_, i) => chunk(`n${i}`)));
    progressStub.getDueChunks.and.returnValue([]);
    progressStub.getCoverage.and.returnValue({ meeting: { learned: 0, total: 8 } });
    progressStub.progress.set(emptyProgress());
    await rebuild();

    expect(comp.sessionQueue().length).toBe(5);
  });
});
