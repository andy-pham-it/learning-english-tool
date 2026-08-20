import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PhraseLabPageComponent } from './phrase-lab-page.component';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { ScenarioService } from '../services/scenario.service';
import { SpeechService } from '../../../core/services/speech.service';
import { signal } from '@angular/core';

describe('PhraseLabPageComponent', () => {
  let fixture: ComponentFixture<PhraseLabPageComponent>;

  beforeEach(async () => {
    const content = jasmine.createSpyObj(
      'PhraseContentService',
      ['loadAll'],
      {
        chunks: signal([{ id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
        templates: signal([
          { id: 't1', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v', structure: '{a}', slots: [{ name: 'a', role: null, options: ['x'] }], example: { en: 'e', vi: 'v' } },
          { id: 't2', domain: 'it', context: 'email', level: 'A2', english: 'e2', vietnamese: 'v2', structure: '{b}', slots: [{ name: 'b', role: null, options: ['y'] }], example: { en: 'e2', vi: 'v2' } },
        ]),
        domains: signal(['it']), contexts: signal(['meeting']), levels: signal(['B2']), loading: signal(false), offline: signal(false),
      } as any
    );
    content.loadAll.and.returnValue(Promise.resolve());
    const progress = jasmine.createSpyObj('PhraseProgressService', ['init', 'recordSpeakResult', 'getDueChunks', 'getCoverage', 'reviewChunk'], {
      authed: signal(false), uid: signal(null),
      progress: signal({ uid: 'local', masteredChunks: {}, masteredTemplates: {}, reviews: {}, streak: { current: 0, lastDay: '' }, totalPoints: 0 }),
    } as any);
    progress.init.and.returnValue(Promise.resolve());
    progress.getDueChunks.and.returnValue([]);
    progress.getCoverage.and.returnValue({});
    progress.reviewChunk.and.returnValue(Promise.resolve());
    const speech = jasmine.createSpyObj('SpeechService', ['speak', 'startListening', 'isRecognitionSupported']);
    speech.isRecognitionSupported.and.returnValue(false);
    const scenarios = jasmine.createSpyObj(
      'ScenarioService',
      ['loadScenarios'],
      {
        scenarios: signal([]), loading: signal(false), offline: signal(false),
      } as any
    );
    scenarios.loadScenarios.and.returnValue(Promise.resolve([]));

    TestBed.configureTestingModule({
      imports: [PhraseLabPageComponent],
      providers: [
        { provide: PhraseContentService, useValue: content },
        { provide: PhraseProgressService, useValue: progress },
        { provide: SpeechService, useValue: speech },
        { provide: ScenarioService, useValue: scenarios },
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
    c.setTab('slot');
    expect(c.selectedTemplate()).not.toBeNull();
    expect(c.selectedTemplate()!.id).toBe('t1');
  });

  it('renders the template selector with all templates', () => {
    const c = fixture.componentInstance;
    c.setTab('slot');
    fixture.detectChanges();
    const options = fixture.nativeElement.querySelectorAll('#template-select option');
    expect(options.length).toBe(2);
    expect(options[1].value).toBe('t2');
  });

  it('selects a template by id from the selector', () => {
    const c = fixture.componentInstance;
    c.setTab('slot');
    c.selectTemplate('t2');
    expect(c.selectedTemplate()!.id).toBe('t2');
    expect(c.templateLabel(c.selectedTemplate()!)).toContain('it · email · A2');
  });

  it('defaults to the Hôm nay tab and renders the daily session', () => {
    const c = fixture.componentInstance;
    expect(c.activeTab()).toBe('today');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-daily-session')).not.toBeNull();
  });

  it('renders the conversation builder on the Hội thoại tab', () => {
    const c = fixture.componentInstance;
    c.setTab('conversation');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-conversation-builder')).not.toBeNull();
  });

  it('does not auto-select a template on today/conversation/explore tabs', () => {
    const c = fixture.componentInstance;
    c.setTab('conversation');
    expect(c.selectedTemplate()).toBeNull();
    c.setTab('explore');
    expect(c.selectedTemplate()).toBeNull();
  });

  it('renders the response practice on the Phản xạ tab without auto-selecting a template', () => {
    const c = fixture.componentInstance;
    c.setTab('response');
    expect(c.selectedTemplate()).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-response-practice')).not.toBeNull();
  });

  it('renders the speaking chain on the Chuỗi nói tab without auto-selecting a template', () => {
    const c = fixture.componentInstance;
    c.setTab('chain');
    expect(c.selectedTemplate()).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-speaking-chain')).not.toBeNull();
  });

  it('computes coverage from getCoverage', () => {
    const c = fixture.componentInstance;
    const progress = TestBed.inject(PhraseProgressService) as jasmine.SpyObj<PhraseProgressService>;
    progress.getCoverage.and.returnValue({ meeting: { learned: 1, total: 2 } });
    (TestBed.inject(PhraseContentService) as any).chunks.set([]); // invalidate the coverage computed so it re-reads the stub
    expect(c.coverage()).toEqual({ learned: 1, total: 2 });
    expect(c.coveragePct()).toBe(50);
  });

  it('renders analysis as a card list without auto-selecting a template', () => {
    const c = fixture.componentInstance;
    c.setTab('analysis');
    expect(c.selectedTemplate()).toBeNull();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('app-sentence-analysis');
    expect(cards.length).toBe(2);
  });

  it('filters the analysis card list by context', () => {
    const c = fixture.componentInstance;
    c.setTab('analysis');
    expect(c.filteredTemplates().length).toBe(2);
    c.selectContext('meeting');
    expect(c.filteredTemplates().length).toBe(1);
    expect(c.filteredTemplates()[0].id).toBe('t1');
    c.selectContext('all');
    expect(c.filteredTemplates().length).toBe(2);
  });

  it('wires rated output to reviewChunk for each chunk id', () => {
    const c = fixture.componentInstance;
    const progress = TestBed.inject(PhraseProgressService) as jasmine.SpyObj<PhraseProgressService>;
    c.onRated({ templateId: 't', chunkIds: ['a', 'b'], rating: 'again' });
    expect(progress.reviewChunk).toHaveBeenCalledWith('a', 'again');
    expect(progress.reviewChunk).toHaveBeenCalledWith('b', 'again');
  });

  it('renders all 10 tab buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('[data-test="tab-button"]');
    expect(buttons.length).toBe(10);
  });

  it('defaults activeTab to today', () => {
    expect(fixture.componentInstance.activeTab()).toBe('today');
  });

  it('moves the underline span to the clicked tab', () => {
    const c = fixture.componentInstance;
    const buttons = fixture.nativeElement.querySelectorAll('[data-test="tab-button"]');
    buttons[3].click(); // 'analysis'
    fixture.detectChanges();
    const underline = fixture.debugElement.query(By.css('[data-test="tab-underline"]'));
    expect(underline).toBeTruthy();
    expect(c.activeTab()).toBe('analysis');
  });
});
