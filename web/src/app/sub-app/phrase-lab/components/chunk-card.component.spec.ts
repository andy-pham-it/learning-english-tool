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

  function setChunk(role: string) {
    fixture.componentRef.setInput('chunk', {
      id: 'x', domain: 'daily', context: 'small-talk', level: 'A2',
      english: 'e', vietnamese: 'v', phonetic: '/p/', role,
      examples: [{ en: 'e', vi: 'v' }],
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
});
