import { Injectable, Signal, computed, signal } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore/lite';
import { PhraseChunk, PhraseTemplate } from '../models/phrase.model';

const CHUNKS_KEY = 'phrase_lab_chunks';
const CHUNKS_TS = 'phrase_lab_chunks_ts';
const TEMPLATES_KEY = 'phrase_lab_templates';
const TEMPLATES_TS = 'phrase_lab_templates_ts';
const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PhraseContentService {
  readonly chunks = signal<PhraseChunk[]>([]);
  readonly templates = signal<PhraseTemplate[]>([]);
  readonly loading = signal(false);
  readonly offline = signal(false);

  readonly domains: Signal<string[]> = computed(() =>
    [...new Set(this.chunks().map((c) => c.domain))].sort()
  );
  readonly contexts: Signal<string[]> = computed(() =>
    [...new Set(this.chunks().map((c) => c.context))].sort()
  );
  readonly levels: Signal<string[]> = computed(() =>
    [...new Set(this.chunks().map((c) => c.level))].sort()
  );

  /**
   * Instance-level indirection over `@angular/fire/firestore/lite`.
   *
   * The lite module re-exports `getDocs` and `collection` as non-configurable
   * getters, so `spyOn(lite, ...)` and `Object.defineProperty(lite, ...)`
   * both fail in the Karma/webpack build. Worse, AngularFire's wrappers throw
   * "AngularFireModule has not been provided" the moment they run outside an
   * AngularFire app, so we have to replace BOTH before the real firestore
   * path is even evaluated. Storing the functions on the instance lets unit
   * tests substitute them with jasmine spies.
   */
  collection: typeof collection;
  getDocs: typeof getDocs;

  constructor(private firestore: Firestore) {
    this.collection = collection;
    this.getDocs = getDocs;
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    await Promise.all([
      this.loadCollection<PhraseChunk>('phrase_chunks', CHUNKS_KEY, CHUNKS_TS, (v) => this.chunks.set(v)),
      this.loadCollection<PhraseTemplate>('phrase_templates', TEMPLATES_KEY, TEMPLATES_TS, (v) => this.templates.set(v)),
    ]);
    this.loading.set(false);
  }

  private readCache<T>(key: string): T[] | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T[];
    } catch {
      return null;
    }
  }

  private async loadCollection<T>(
    name: string,
    key: string,
    tsKey: string,
    sink: (v: T[]) => void
  ): Promise<T[]> {
    const freshCache = this.readCache<T>(key);
    const ts = Number(localStorage.getItem(tsKey) ?? 0);
    if (freshCache && Date.now() - ts <= TTL_MS) {
      sink(freshCache);
      return freshCache;
    }
    try {
      const snap = await this.getDocs(this.collection(this.firestore, name));
      const data = snap.docs.map((d) => d.data() as T);
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(tsKey, String(Date.now()));
      this.offline.set(false);
      sink(data);
      return data;
    } catch {
      this.offline.set(true);
      const stale = this.readCache<T>(key);
      if (stale) sink(stale);
      return stale ?? [];
    }
  }
}
