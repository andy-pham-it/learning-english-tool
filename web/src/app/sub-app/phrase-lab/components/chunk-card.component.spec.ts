import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChunkCardComponent } from './chunk-card.component';
import { PhraseProgressService } from '../services/phrase-progress.service';

describe('ChunkCardComponent', () => {
  let fixture: ComponentFixture<ChunkCardComponent>;

  beforeEach(async () => {
    const progress = jasmine.createSpyObj(
      'PhraseProgressService',
      ['markChunkLearned'],
      { authed: signal(false), uid: signal(null), progress: signal(null) },
    );
    await TestBed.configureTestingModule({
      imports: [ChunkCardComponent],
      providers: [{ provide: PhraseProgressService, useValue: progress }],
    }).compileComponents();
    fixture = TestBed.createComponent(ChunkCardComponent);
  });

  function setChunk(role: string, usage?: string, examples: { en: string; vi: string }[] = [{ en: 'e', vi: 'v' }]) {
    fixture.componentRef.setInput('chunk', {
      id: 'x', domain: 'daily', context: 'small-talk', level: 'A2',
      english: 'e', vietnamese: 'v', phonetic: '/p/', role,
      usage,
      examples,
    });
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
});
