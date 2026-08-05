import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SentenceAnalysisComponent } from './sentence-analysis.component';
import { PhraseTemplate } from '../models/phrase.model';

describe('SentenceAnalysisComponent', () => {
  let fixture: ComponentFixture<SentenceAnalysisComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SentenceAnalysisComponent] });
    fixture = TestBed.createComponent(SentenceAnalysisComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2',
      english: 'It would be better if we could take into consideration the load before we proceed.',
      vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('renders the role-colored structure parts', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('[linker]');
  });
});
