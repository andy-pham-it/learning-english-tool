import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ChunkBrowserComponent } from './chunk-browser.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';
import { PaginationComponent } from '../../../shared/ui/pagination.component';

const progressStub = jasmine.createSpyObj('PhraseProgressService',
  ['getDueChunks', 'getCoverage', 'reviewChunk', 'markChunkLearned', 'recordSpeakResult']);
progressStub.progress = signal(null);

const speechStub = { speak: jasmine.createSpy('speak'), startListening: jasmine.createSpy('startListening'), isRecognitionSupported: () => false };

const makeChunks = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `c${i}`, domain: 'it', context: 'meeting', level: 'B2',
  english: `Word ${i}`, vietnamese: `Từ ${i}`, phonetic: '/wɜːrd/',
  role: 'opener', usage: 'Ví dụ', examples: [],
}));

describe('chunk browser pagination', () => {
  let fixture: ComponentFixture<ChunkBrowserComponent>;
  let component: ChunkBrowserComponent;
  let chunks: ReturnType<typeof signal<any[]>>;

  beforeEach(async () => {
    chunks = signal(makeChunks(25));
    await TestBed.configureTestingModule({
      imports: [ChunkBrowserComponent],
      providers: [
        { provide: PhraseContentService, useValue: { chunks, domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']), loadAll: jasmine.createSpy('loadAll'), offline: signal(false) } },
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: SpeechService, useValue: speechStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChunkBrowserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders only the first page (20 of 25) cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-chunk-card');
    expect(cards.length).toBe(20);
  });

  it('shows the pagination control when there is more than one page', () => {
    expect(fixture.debugElement.query(By.directive(PaginationComponent))).toBeTruthy();
  });

  it('goes to page 2 via the pagination component and shows 5 cards', () => {
    const pg = fixture.debugElement.query(By.directive(PaginationComponent)).componentInstance as PaginationComponent;
    pg.goToPage(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-chunk-card').length).toBe(5);
  });

  it('resets to page 1 when a filter changes', () => {
    const pg = fixture.debugElement.query(By.directive(PaginationComponent)).componentInstance as PaginationComponent;
    pg.goToPage(2);
    component.selectDomain('all');
    fixture.detectChanges();
    expect(component.page()).toBe(1);
  });

  it('shows an empty state when no chunks match filters', () => {
    chunks.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chưa có từ vựng');
  });
});
