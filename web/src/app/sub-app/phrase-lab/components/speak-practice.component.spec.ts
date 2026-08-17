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
            chunks: signal([
              { id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] },
              { id: 'bet-chunk', domain: 'it', context: 'meeting', level: 'B2', english: 'bet', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] },
            ]),
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

  it('emits rated with the chosen rating and shows a label', () => {
    const c = fixture.componentInstance;
    const spy = spyOn(c.rated, 'emit');
    c.rate('easy');
    expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({ rating: 'easy', templateId: 't' }));
    expect(c.ratedLabel()).toBe('Easy');
  });

  it('toggles shadowing mode', () => {
    const c = fixture.componentInstance;
    expect(c.hideText()).toBeFalse();
    c.toggleShadow();
    expect(c.hideText()).toBeTrue();
    c.toggleShadow();
    expect(c.hideText()).toBeFalse();
  });

  it('toggles production mode and reveals answer', () => {
    const c = fixture.componentInstance;
    expect(c.productionMode()).toBeFalse();
    c.toggleProductionMode();
    expect(c.productionMode()).toBeTrue();
    expect(c.showProductionAnswer()).toBeFalse();
    c.revealProductionAnswer();
    expect(c.showProductionAnswer()).toBeTrue();
  });

  it('sets shadow speed', () => {
    const c = fixture.componentInstance;
    expect(c.shadowSpeed()).toBe('normal');
    c.setShadowSpeed('slow');
    expect(c.shadowSpeed()).toBe('slow');
    c.setShadowSpeed('fast');
    expect(c.shadowSpeed()).toBe('fast');
  });

  it('plays shadow with the correct TTS rate for the selected speed', () => {
    const c = fixture.componentInstance;
    c.setShadowSpeed('slow');
    c.playShadow();
    expect(speech.speak).toHaveBeenCalledWith(jasmine.any(String), 'en-US', 0.7);
    c.setShadowSpeed('fast');
    c.playShadow();
    expect(speech.speak).toHaveBeenCalledWith(jasmine.any(String), 'en-US', 1.3);
  });

  it('scores the repeated speech and marks the shadow step done', async () => {
    const c = fixture.componentInstance;
    await c.repeatShadow();
    expect(c.shadowStep()).toBe('done');
    expect(c.shadowScore()).not.toBeNull();
  });

  it('records audio locally and exposes a replay URL', async () => {
    const c = fixture.componentInstance;
    const stopTrack = jasmine.createSpy('stopTrack');
    const stream = { getTracks: () => [{ stop: stopTrack }] } as any;
    spyOn(navigator.mediaDevices, 'getUserMedia').and.resolveTo(stream);
    const rec = new FakeMediaRecorder();
    spyOn(window as any, 'MediaRecorder').and.returnValue(rec);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake-recording');
    await c.toggleRecording();
    expect(c.recording()).toBeTrue();
    expect(rec.start).toHaveBeenCalled();
    await c.toggleRecording();
    expect(rec.stop).toHaveBeenCalled();
    expect(c.recording()).toBeFalse();
    expect(c.recordingUrl()).toBe('blob:fake-recording');
    expect(stopTrack).toHaveBeenCalled();
  });

  it('stays non-recording when the mic permission is denied', async () => {
    const c = fixture.componentInstance;
    spyOn(navigator.mediaDevices, 'getUserMedia').and.rejectWith(new Error('denied'));
    await c.toggleRecording();
    expect(c.recording()).toBeFalse();
    expect(c.recordingUrl()).toBeNull();
  });

  it('markMastered emits once and sets masteredDone', () => {
    const c = fixture.componentInstance;
    const emitSpy = spyOn(c.mastered, 'emit');
    c.markMastered();
    c.markMastered();
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(c.masteredDone()).toBeTrue();
  });

  it('chunkIds matches whole phrase, not substring', () => {
    const c = fixture.componentInstance;
    // 'bet' is a substring of 'better' in the target — must NOT match as a whole word.
    expect(c.chunkIds()).not.toContain('bet-chunk');
  });
});

class FakeMediaRecorder {
  ondataavailable: ((evt: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly start = jasmine.createSpy('start');
  readonly stop = jasmine.createSpy('stop').and.callFake(() => this.onstop?.());
}
