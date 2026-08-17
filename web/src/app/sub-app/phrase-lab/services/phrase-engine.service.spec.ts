import { TestBed } from '@angular/core/testing';
import { PhraseEngineService } from './phrase-engine.service';
import { PhraseChunk, PhraseTemplate } from '../models/phrase.model';

const CHUNKS: PhraseChunk[] = [
  { id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'cân nhắc, xem xét', phonetic: '/teɪk ˈɪntə kənˌsɪdəˈreɪʃən/', role: 'linker', examples: [{ en: 'We should take the load into consideration.', vi: 'Chúng ta nên cân nhắc tải hệ thống.' }] },
  { id: 'it-meet-b1-01', domain: 'it', context: 'meeting', level: 'B1', english: 'I would like to add that', vietnamese: 'tôi muốn bổ sung rằng', phonetic: '/aɪ wʊd laɪk tə æd ðæt/', role: 'opener', examples: [{ en: 'I would like to add that we are on schedule.', vi: 'Tôi muốn bổ sung rằng chúng ta đúng tiến độ.' }] },
];

const TEMPLATE: PhraseTemplate = {
  id: 'tpl-it-meet-01', domain: 'it', context: 'meeting', level: 'B2',
  english: 'It would be better if we could take into consideration the system load before we proceed.',
  vietnamese: 'Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục.',
  structure: 'It would be better if {subject} {modal} {chunk:linker} the {noun} before we {verb}.',
  slots: [
    { name: 'subject', role: null, options: ['we', 'you', 'the team'] },
    { name: 'modal', role: null, options: ['could', 'would', 'can'] },
    { name: 'linker', role: 'linker' },
    { name: 'noun', role: null, options: ['system load', 'performance', 'the requirements'] },
    { name: 'verb', role: null, options: ['proceed', 'move on'] },
  ],
  example: { en: 'It would be better if we could take into consideration the system load before we proceed.', vi: 'Sẽ tốt hơn nếu chúng ta cân nhắc tải hệ thống trước khi tiếp tục.' },
};

describe('PhraseEngineService', () => {
  let engine: PhraseEngineService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    engine = TestBed.inject(PhraseEngineService);
  });

  it('buildSentence fills named slots and chunk:role placeholders, then caps placeholders', () => {
    const s = engine.buildSentence(TEMPLATE, [
      { name: 'subject', value: 'we' }, { name: 'modal', value: 'could' },
      { name: 'linker', value: 'take into consideration' }, { name: 'noun', value: 'system load' },
      { name: 'verb', value: 'proceed' },
    ]);
    expect(s).toBe('It would be better if we could take into consideration the system load before we proceed.');
  });

  it('buildSentence replaces unfilled placeholders with ___', () => {
    const s = engine.buildSentence(TEMPLATE, []);
    expect(s).toContain('___');
  });

  it('combineByRole accepts a matching chunk and builds a sentence', () => {
    const r = engine.combineByRole(TEMPLATE, CHUNKS, { linker: 'it-meet-b2-01' });
    expect(r.errors).toEqual([]);
    expect(r.sentence).toContain('take into consideration');
  });

  it('combineByRole rejects a chunk of a different level', () => {
    const r = engine.combineByRole(TEMPLATE, CHUNKS, { linker: 'it-meet-b1-01' });
    expect(r.sentence).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('combineByRole rejects when a role slot is unselected', () => {
    const r = engine.combineByRole(TEMPLATE, CHUNKS, {});
    expect(r.sentence).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('expectedSequence returns fill values in structure order', () => {
    expect(engine.expectedSequence(TEMPLATE, CHUNKS)).toEqual([
      'we', 'could', 'take into consideration', 'system load', 'proceed',
    ]);
  });

  it('validateOrder passes for the correct order and flags swapped positions', () => {
    const correct = ['we', 'could', 'take into consideration', 'system load', 'proceed'];
    expect(engine.validateOrder(TEMPLATE, CHUNKS, correct).correct).toBeTrue();
    const swapped = ['we', 'could', 'system load', 'take into consideration', 'proceed'];
    const r = engine.validateOrder(TEMPLATE, CHUNKS, swapped);
    expect(r.correct).toBeFalse();
    expect(r.positionErrors).toEqual([2, 3]);
  });

  it('annotateStructure tags chunk placeholders with their role', () => {
    const parts = engine.annotateStructure(TEMPLATE);
    const linker = parts.find((p) => p.text === '[linker]');
    expect(linker?.role).toBe('linker');
    expect(parts.some((p) => p.text === '[subject]' && p.role === null)).toBeTrue();
  });

  it('buildSentence keeps an exclamation ending', () => {
    const tpl = {
      id: 't', domain: 'd', context: 'c', level: 'B2',
      english: 'e', vietnamese: 'v',
      structure: 'Let\'s go {slot}!',
      slots: [{ name: 'slot', role: null, options: ['now'] }],
      example: { en: 'e', vi: 'v' },
    } as any;
    const out = engine.buildSentence(tpl, [{ name: 'slot', value: 'now' }]);
    expect(out.endsWith('!')).toBeTrue();
    expect(out.endsWith('.')).toBeFalse();
  });

  it('scoreSpeech scores 100 on exact match and lists missing words otherwise', () => {
    const target = 'It would be better if we could proceed.';
    expect(engine.scoreSpeech(target, 'it would be better if we could proceed').score).toBe(100);
    const r = engine.scoreSpeech(target, 'we could proceed');
    expect(r.score).toBeLessThan(80);
    expect(r.wrongWords).toContain('it');
  });
});
