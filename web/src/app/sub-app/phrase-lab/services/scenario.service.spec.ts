import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore/lite';
import { ScenarioService } from './scenario.service';
import type { Scenario } from '../models/scenario.model';

describe('ScenarioService', () => {
  let service: ScenarioService;
  let getDocsSpy: jasmine.Spy;

  const scenario = (id: string): Scenario => ({
    id,
    level: 'A2',
    context: 'meeting',
    title: 'T',
    turns: [{ speakerLine: 'Hi', answers: [{ ids: ['x'] }], replyLine: 'Ok' }],
  });

  const installFirestoreSpies = (docs: unknown[]) => {
    const collectionSpy = jasmine
      .createSpy('collection')
      .and.callFake((_fs: unknown, name: string) => ({ path: name, id: name }));
    getDocsSpy = jasmine
      .createSpy('getDocs')
      .and.callFake(() =>
        Promise.resolve({
          docs: docs.map((d) => ({ id: (d as { id: string }).id, data: () => d })),
        })
      );
    const docSpy = jasmine
      .createSpy('doc')
      .and.callFake((_fs: unknown, _col: string, id: string) => ({ path: id, id }));
    const getDocSpy = jasmine
      .createSpy('getDoc')
      .and.callFake(() => Promise.resolve({ data: () => ({ version: 1 }) }));
    service.collection = collectionSpy as never;
    service.getDocs = getDocsSpy as never;
    service.doc = docSpy as never;
    service.getDoc = getDocSpy as never;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: Firestore, useValue: {} }] });
    service = TestBed.inject(ScenarioService);
  });

  it('fetch scenarios khi cache rỗng và populate cache', async () => {
    installFirestoreSpies([scenario('scn-1'), { id: 'meta', version: 1 }]);
    const result = await service.loadScenarios();
    expect(getDocsSpy).toHaveBeenCalled();
    expect(result.map((s) => s.id)).toEqual(['scn-1']);
    expect(service.scenarios().map((s) => s.id)).toEqual(['scn-1']);
    expect(localStorage.getItem('phrase_lab_scenarios')).toContain('scn-1');
    expect(service.offline()).toBe(false);
  });

  it('loại doc meta khỏi danh sách scenario', async () => {
    installFirestoreSpies([scenario('scn-1'), { id: 'meta', version: 1 }]);
    const result = await service.loadScenarios();
    expect(result.map((s) => s.id)).not.toContain('meta');
  });

  it('dùng cache 24h + cùng version, không gọi getDocs collection', async () => {
    localStorage.setItem('phrase_lab_scenarios', JSON.stringify([scenario('scn-1')]));
    localStorage.setItem('phrase_lab_scenarios_ts', String(Date.now()));
    localStorage.setItem('phrase_lab_scenarios_version', '1');
    installFirestoreSpies([scenario('scn-2'), { id: 'meta', version: 1 }]);
    const result = await service.loadScenarios();
    expect(getDocsSpy).not.toHaveBeenCalled();
    expect(result.map((s) => s.id)).toEqual(['scn-1']);
  });

  it('version lệch -> refetch (bỏ cache)', async () => {
    localStorage.setItem('phrase_lab_scenarios', JSON.stringify([scenario('scn-1')]));
    localStorage.setItem('phrase_lab_scenarios_ts', String(Date.now() - 25 * 60 * 60 * 1000)); // stale
    localStorage.setItem('phrase_lab_scenarios_version', '0');
    installFirestoreSpies([scenario('scn-2'), { id: 'meta', version: 1 }]);
    const result = await service.loadScenarios();
    expect(getDocsSpy).toHaveBeenCalled();
    expect(result.map((s) => s.id)).toEqual(['scn-2']);
  });

  it('loadScenarios skips fetchVersion when cache is fresh', async () => {
    localStorage.setItem('phrase_lab_scenarios', JSON.stringify([{ id: 's1' }]));
    localStorage.setItem('phrase_lab_scenarios_ts', String(Date.now()));
    localStorage.setItem('phrase_lab_scenarios_version', '0');
    const fetchSpy = spyOn(service as any, 'fetchVersion').and.callThrough();
    service.offline.set(true);
    await service.loadScenarios();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(service.offline()).toBeFalse();
  });

  it('offline + không có cache -> offline signal true, trả []', async () => {
    installFirestoreSpies([]);
    getDocsSpy.and.returnValue(Promise.reject(new Error('network')));
    const result = await service.loadScenarios();
    expect(service.offline()).toBe(true);
    expect(result).toEqual([]);
  });
});
