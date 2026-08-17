import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SpeakingChainComponent } from './speaking-chain.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { SpeechService } from '../../../core/services/speech.service';
import { signal } from '@angular/core';
import { PhraseChunk } from '../models/phrase.model';

function chunk(id: string, role: PhraseChunk['role'], english: string): PhraseChunk {
  return {
    id,
    domain: 'it',
    context: 'meeting',
    level: 'B2',
    english,
    vietnamese: 'v',
    phonetic: '/p/',
    role,
    examples: [],
  };
}

describe('SpeakingChainComponent', () => {
  let fixture: ComponentFixture<SpeakingChainComponent>;
  const speech = jasmine.createSpyObj('SpeechService', ['isRecognitionSupported', 'startListening', 'speak']);

  beforeEach(async () => {
    speech.isRecognitionSupported.and.returnValue(true);
    speech.startListening.and.returnValue(Promise.resolve('Let me start by saying Moreover you know'));
    TestBed.configureTestingModule({
      imports: [SpeakingChainComponent],
      providers: [
        { provide: SpeechService, useValue: speech },
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal<PhraseChunk[]>([
              chunk('a-opener', 'opener', 'Let me start by saying'),
              chunk('b-linker', 'linker', 'Moreover'),
              chunk('c-filler', 'filler', 'you know'),
              chunk('d-closer', 'closer', 'To sum up'),
            ]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(SpeakingChainComponent);
    fixture.detectChanges();
  });

  it('generates chunks and a model passage for a context', () => {
    const c = fixture.componentInstance;
    c.selectContext('meeting');
    c.generate();
    expect(c.chunks().length).toBeGreaterThanOrEqual(4);
    expect(c.modelPassage()).toContain('Let me start by saying');
  });

  it('counts down the timer from 30 to 0 then stops', fakeAsync(() => {
    const c = fixture.componentInstance;
    c.startTimer();
    expect(c.isRunning()).toBeTrue();
    tick(30000);
    expect(c.timer()).toBe(0);
    expect(c.isRunning()).toBeFalse();
  }));

  it('listens and sets feedback from the transcript', async () => {
    const c = fixture.componentInstance;
    c.selectContext('meeting');
    c.generate();
    await c.startSpeaking();
    expect(speech.startListening).toHaveBeenCalled();
    expect(c.feedback()).not.toBeNull();
    expect(c.feedback()!.covered.length).toBeGreaterThan(0);
  });

  it('plays the model passage via TTS', () => {
    const c = fixture.componentInstance;
    c.selectContext('meeting');
    c.generate();
    c.playModel();
    expect(speech.speak).toHaveBeenCalledWith(c.modelPassage(), 'en-US');
  });

  it('startSpeaking never computes a zero duration (wpm floor)', async () => {
    const c = fixture.componentInstance;
    c.selectContext('meeting');
    c.generate();
    c.timer.set(30); // no timer started -> 30 - 30 = 0
    await c.startSpeaking();
    expect(c.feedback()!.wpm).toBeGreaterThan(0);
  });

  it('ngOnDestroy clears the running timer', fakeAsync(() => {
    const c = fixture.componentInstance;
    c.startTimer();
    expect(c.isRunning()).toBeTrue();
    c.ngOnDestroy();
    tick(31000);
    expect(c.isRunning()).toBeTrue(); // interval cleared, so never auto-stops
  }));
});
