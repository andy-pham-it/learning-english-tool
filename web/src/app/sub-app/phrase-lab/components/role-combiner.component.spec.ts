import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RoleCombinerComponent } from './role-combiner.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { signal } from '@angular/core';

describe('RoleCombinerComponent', () => {
  let fixture: ComponentFixture<RoleCombinerComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RoleCombinerComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'cân nhắc', phonetic: '/p/', role: 'linker', examples: [] }]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(RoleCombinerComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('combines a valid selection into a sentence', () => {
    const c = fixture.componentInstance;
    c.selection.set({ linker: 'it-meet-b2-01' });
    expect(c.result().sentence).toContain('take into consideration');
  });

  it('reports errors when a role slot is missing', () => {
    const c = fixture.componentInstance;
    c.selection.set({});
    expect(c.result().sentence).toBeNull();
    expect(c.result().errors.length).toBeGreaterThan(0);
  });
});
