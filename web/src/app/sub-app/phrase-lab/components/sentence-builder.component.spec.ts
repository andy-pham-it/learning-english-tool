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
});
