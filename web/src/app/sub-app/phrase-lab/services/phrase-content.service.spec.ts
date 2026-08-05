import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import { PhraseContentService } from './phrase-content.service';
import { PhraseChunk, PhraseTemplate } from '../models/phrase.model';

describe('PhraseContentService', () => {
  let service: PhraseContentService;
  let getDocsSpy: jasmine.Spy;
  let collectionSpy: jasmine.Spy;

  const installFirestoreSpies = (): void => {
    collectionSpy = jasmine.createSpy('collection').and.callFake((_fs: unknown, name: string) => ({ path: name, id: name }));
    getDocsSpy = jasmine.createSpy('getDocs');
    service.collection = collectionSpy as any;
    service.getDocs = getDocsSpy as any;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: {} }],
    });
    service = TestBed.inject(PhraseContentService);
  });

  it('fetches from Firestore when cache is empty and populates the cache', async () => {
    const chunk: PhraseChunk = { id: 'c1', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'x', phonetic: '/x/', role: 'linker', examples: [{ en: 'e', vi: 'v' }] };
    const template: PhraseTemplate = { id: 't1', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v', structure: '{a}', slots: [{ name: 'a', role: null, options: ['x'] }], example: { en: 'e', vi: 'v' } };
    installFirestoreSpies();
    getDocsSpy.and.callFake((ref: any) => {
      const name = ref.path ?? ref.id;
      const docs = name === 'phrase_chunks' ? [chunk] : [template];
      return Promise.resolve({ docs: docs.map((d) => ({ data: () => d })) } as any);
    });

    await service.loadAll();

    expect(getDocsSpy).toHaveBeenCalledTimes(2);
    expect(service.chunks()).toEqual([chunk]);
    expect(service.templates()).toEqual([template]);
    expect(service.domains()).toEqual(['it']);
    expect(localStorage.getItem('phrase_lab_chunks')).toBeTruthy();
  });

  it('uses the 24h cache and does not hit Firestore on a fresh cache', async () => {
    localStorage.setItem('phrase_lab_chunks', JSON.stringify([{ id: 'c1' }]));
    localStorage.setItem('phrase_lab_chunks_ts', String(Date.now()));
    localStorage.setItem('phrase_lab_templates', JSON.stringify([{ id: 't1' }]));
    localStorage.setItem('phrase_lab_templates_ts', String(Date.now()));
    installFirestoreSpies();
    getDocsSpy.and.returnValue(Promise.resolve({ docs: [] } as any));

    await service.loadAll();

    expect(getDocsSpy).not.toHaveBeenCalled();
    expect(service.chunks()).toEqual([{ id: 'c1' }] as any);
    expect(service.templates()).toEqual([{ id: 't1' }] as any);
  });

  it('sets offline and keeps stale cache when Firestore fails', async () => {
    localStorage.setItem('phrase_lab_chunks', JSON.stringify([{ id: 'c1' }]));
    localStorage.setItem('phrase_lab_chunks_ts', String(Date.now() - 25 * 60 * 60 * 1000)); // stale
    installFirestoreSpies();
    getDocsSpy.and.returnValue(Promise.reject(new Error('network')));

    await service.loadAll();

    expect(service.offline()).toBeTrue();
    expect(service.chunks()).toEqual([{ id: 'c1' }] as any);
  });
});
