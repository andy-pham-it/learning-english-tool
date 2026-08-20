import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ChunkCardComponent } from './chunk-card.component';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';
import { ProgressRingComponent } from '../../../shared/ui/progress-ring.component';

describe('ChunkCardComponent', () => {
  let fixture: ComponentFixture<ChunkCardComponent>;
  let component: ChunkCardComponent;
  let progress: jasmine.SpyObj<PhraseProgressService>;

  beforeEach(async () => {
    progress = jasmine.createSpyObj(
      'PhraseProgressService',
      ['markChunkLearned'],
      { authed: signal(false), uid: signal(null), progress: signal(null) },
    );
    await TestBed.configureTestingModule({
      imports: [ChunkCardComponent],
      providers: [
        { provide: PhraseProgressService, useValue: progress },
        { provide: SpeechService, useValue: { speak: jasmine.createSpy('speak'), isRecognitionSupported: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ChunkCardComponent);
    component = fixture.componentInstance;
  });

  function setChunk(role: string, usage?: string, examples: { en: string; vi: string }[] = [{ en: 'e', vi: 'v' }]) {
    fixture.componentRef.setInput('chunk', {
      id: 'x', domain: 'daily', context: 'small-talk', level: 'A2',
      english: 'e', vietnamese: 'v', phonetic: '/p/', role,
      usage,
      examples,
    });
  }

  function makeChunk(over: Partial<Record<string, unknown>> = {}) {
    fixture.componentRef.setInput('chunk', {
      id: 'c1', domain: 'it', context: 'meeting', level: 'B2',
      english: 'Let me get back to you', vietnamese: 'Để tôi liên hệ lại bạn sau',
      phonetic: '/lɛt miː gɛt bæk tə juː/', role: 'closer', usage: 'Dùng khi kết thúc cuộc họp', examples: [],
      ...over,
    });
    fixture.detectChanges();
  }

  it('maps reaction to rose badge classes', () => {
    setChunk('reaction');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('span.text-xs') as HTMLElement;
    expect(badge.className).toContain('bg-rose-100');
    expect(badge.className).toContain('text-rose-700');
  });

  it('maps question to amber badge classes', () => {
    setChunk('question');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('span.text-xs') as HTMLElement;
    expect(badge.className).toContain('bg-amber-100');
    expect(badge.className).toContain('text-amber-700');
  });

  it('shows usage block when chunk has usage', () => {
    setChunk('opener', 'Dùng khi mở đầu cuộc họp.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Khi nào dùng?');
    expect(fixture.nativeElement.textContent).toContain('Dùng khi mở đầu cuộc họp.');
  });

  it('hides usage block when chunk has no usage', () => {
    setChunk('opener');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Khi nào dùng?');
  });

  it('shows all examples', () => {
    setChunk('opener', undefined, [
      { en: 'First example', vi: 'Ví dụ một' },
      { en: 'Second example', vi: 'Ví dụ hai' },
    ]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('First example');
    expect(text).toContain('Second example');
  });

  it('creates', () => expect(component).toBeTruthy());

  it('renders the level badge with the chunk level', () => {
    makeChunk();
    const badge = fixture.debugElement.query(By.css('[data-test="level-badge"]'));
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('B2');
  });

  it('shows 0% ring when not reviewed', () => {
    makeChunk();
    expect(component.cardProgress()).toBe(0);
    expect(fixture.debugElement.query(By.directive(ProgressRingComponent))).toBeTruthy();
  });

  it('shows 100% ring when mastered', () => {
    makeChunk();
    progress.progress.set({ uid: 'u1', masteredChunks: { c1: { status: 'mastered', speakScore: 90, lastPracticed: Date.now() } }, masteredTemplates: {}, reviews: {}, streak: { current: 0, lastDay: '' }, totalPoints: 0 });
    fixture.detectChanges();
    expect(component.cardProgress()).toBe(100);
  });
});