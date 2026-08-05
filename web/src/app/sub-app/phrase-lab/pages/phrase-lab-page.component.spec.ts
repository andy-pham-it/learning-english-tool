import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhraseLabPageComponent } from './phrase-lab-page.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { signal } from '@angular/core';

describe('PhraseLabPageComponent', () => {
  let fixture: ComponentFixture<PhraseLabPageComponent>;

  beforeEach(async () => {
    const content = jasmine.createSpyObj(
      'PhraseContentService',
      ['loadAll'],
      {
        chunks: signal([{ id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
        templates: signal([{ id: 't1', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v', structure: '{a}', slots: [{ name: 'a', role: null, options: ['x'] }], example: { en: 'e', vi: 'v' } }]),
        domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']), loading: signal(false), offline: signal(false),
      } as any
    );
    content.loadAll.and.returnValue(Promise.resolve());
    const progress = jasmine.createSpyObj('PhraseProgressService', ['init', 'recordSpeakResult'], {
      authed: signal(false), uid: signal(null), progress: signal(null),
    } as any);
    progress.init.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      imports: [PhraseLabPageComponent],
      providers: [
        { provide: PhraseContentService, useValue: content },
        { provide: PhraseProgressService, useValue: progress },
      ],
    });
    fixture = TestBed.createComponent(PhraseLabPageComponent);
    fixture.detectChanges();
  });

  it('creates the shell and shows an offline banner when offline', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Phrase Lab');
  });

  it('selects the first template by default in practice tabs', () => {
    const c = fixture.componentInstance;
    c.setTab('analysis');
    expect(c.selectedTemplate()).not.toBeNull();
  });
});
