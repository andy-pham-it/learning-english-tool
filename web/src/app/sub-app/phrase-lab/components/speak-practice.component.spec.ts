import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpeakPracticeComponent } from './speak-practice.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';
import { signal } from '@angular/core';

describe('SpeakPracticeComponent', () => {
  let fixture: ComponentFixture<SpeakPracticeComponent>;
  const speech = jasmine.createSpyObj('SpeechService', ['isRecognitionSupported', 'startListening', 'speak']);

  beforeEach(async () => {
    speech.isRecognitionSupported.and.returnValue(true);
    speech.startListening.and.returnValue(Promise.resolve('it would be better if we could take into consideration the load'));
    TestBed.configureTestingModule({
      imports: [SpeakPracticeComponent],
      providers: [
        { provide: SpeechService, useValue: speech },
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(SpeakPracticeComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'It would be better if we could take into consideration the load.', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('builds a target sentence from the template defaults', () => {
    expect(fixture.componentInstance.target()).toContain('take into consideration');
  });

  it('scores speech and emits mastered on high score', async () => {
    const c = fixture.componentInstance;
    const emitSpy = spyOn(c.mastered, 'emit');
    await c.startListening();
    expect(c.feedback()?.score).toBeGreaterThanOrEqual(80);
    expect(emitSpy).toHaveBeenCalled();
  });
});
