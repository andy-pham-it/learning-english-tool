import { Injectable, signal } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs } from '@angular/fire/firestore/lite';
import type { Scenario } from '../models/scenario.model';

const SCENARIOS_KEY = 'phrase_lab_scenarios';
const SCENARIOS_TS = 'phrase_lab_scenarios_ts';
const SCENARIOS_VERSION = 'phrase_lab_scenarios_version';
const TTL_MS = 24 * 60 * 60 * 1000;
const COLLECTION = 'phrase_scenarios';
const META_ID = 'meta';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  readonly scenarios = signal<Scenario[]>([]);
  readonly loading = signal(false);
  readonly offline = signal(false);

  // Instance indirection để test spy (copy pattern PhraseContentService —
  // lite module re-exports non-configurable getters; AngularFire wrappers
  // throw "AngularFireModule has not been provided" ngoài app context).
  collection: typeof collection;
  getDocs: typeof getDocs;
  doc: typeof doc;
  getDoc: typeof getDoc;

  constructor(private readonly firestore: Firestore) {
    this.collection = collection;
    this.getDocs = getDocs;
    this.doc = doc;
    this.getDoc = getDoc;
  }

  /**
   * Load scenarios: đọc doc meta (1 read) để lấy version; nếu cache còn
   * trong TTL 24h VÀ version trùng version cached -> dùng cache.
   * Lệch version / hết TTL -> refetch toàn bộ (đảm bảo scenario mới
   * hiện ngay sau khi seed mà không cần chờ hết TTL).
   */
  async loadScenarios(): Promise<Scenario[]> {
    const version = await this.fetchVersion();
    const cache = this.readCache<Scenario[]>(SCENARIOS_KEY);
    const ts = this.readNumber(SCENARIOS_TS);
    if (cache && ts !== null && Date.now() - ts <= TTL_MS && this.readNumber(SCENARIOS_VERSION) === version) {
      this.scenarios.set(cache);
      return cache;
    }
    this.loading.set(true);
    try {
      const snap = await this.getDocs(this.collection(this.firestore, COLLECTION));
      const docs = snap.docs
        .filter((d) => d.id !== META_ID)
        .map((d) => d.data() as Scenario);
      localStorage.setItem(SCENARIOS_KEY, JSON.stringify(docs));
      localStorage.setItem(SCENARIOS_TS, String(Date.now()));
      localStorage.setItem(SCENARIOS_VERSION, String(version));
      this.offline.set(false);
      this.scenarios.set(docs);
      return docs;
    } catch {
      this.offline.set(true);
      if (cache) {
        this.scenarios.set(cache);
        return cache;
      }
      this.scenarios.set([]);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchVersion(): Promise<number> {
    try {
      const snap = await this.getDoc(this.doc(this.firestore, COLLECTION, META_ID));
      const data = snap.data() as { version?: number } | undefined;
      return data?.version ?? 0;
    } catch {
      return 0;
    }
  }

  private readCache<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private readNumber(key: string): number | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
}
