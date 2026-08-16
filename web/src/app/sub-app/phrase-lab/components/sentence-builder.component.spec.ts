import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SentenceBuilderComponent } from './sentence-builder.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { signal } from '@angular/core';

describe('SentenceBuilderComponent', () => {
  let fixture: ComponentFixture<SentenceBuilderComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SentenceBuilderComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
            domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(SentenceBuilderComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we', 'you'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('previews a filled sentence', () => {
    const c = fixture.componentInstance;
    c.values.set({ subject: 'we', linker: 'take into consideration' });
    expect(c.preview()).toContain('we take into consideration');
    expect(c.preview()).not.toContain('___');
  });

  it('renders one select card per option with english and vietnamese', () => {
    const cards = Array.from(fixture.nativeElement.querySelectorAll('fieldset button')) as HTMLElement[];
    expect(cards.length).toBe(3);
    const texts = cards.map((b) => b.textContent ?? '');
    expect(texts.join(' ')).toContain('take into consideration — v');
  });

  it('selects a card on click and updates the preview', () => {
    const c = fixture.componentInstance;
    const cards = Array.from(fixture.nativeElement.querySelectorAll('fieldset button')) as HTMLElement[];
    cards[0].click();
    fixture.detectChanges();
    expect(c.values()['subject']).toBe('we');
    expect(c.preview()).toContain('we');
  });
});
