import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryAiService } from './dictionary-ai.service';
import { DictionaryStorageService } from './dictionary-storage.service';
import { DictionaryResult, VocabItem } from './models';

type SortMode = 'alpha-asc' | 'alpha-desc' | 'time';

@Component({
  selector: 'app-dictionary-sub-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dictionary-sub-app.component.html',
  styleUrls: ['./dictionary-sub-app.component.css'],
})
export class DictionarySubAppComponent implements OnInit, OnDestroy {
  private aiService = inject(DictionaryAiService);
  private storageService = inject(DictionaryStorageService);
  private hubOrigin: string | null = null;
  private hubAuthTimer: ReturnType<typeof setTimeout> | null = null;
  private _hubMessageHandler: ((event: MessageEvent) => void) | null = null;

  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  vocabulary = signal<Record<string, VocabItem>>({});
  isSidebarOpen = signal(false);
  sortBy = signal<SortMode>('time');
  isHubAuth = signal(false);
  hubMessage = signal('Connecting to The Hub...');

  vocabWordsSorted = computed(() => {
    const vocab = this.vocabulary();
    const entries = Object.entries(vocab);
    switch (this.sortBy()) {
      case 'alpha-asc':
        return entries.sort(([a], [b]) => a.localeCompare(b)).map(([w]) => w);
      case 'alpha-desc':
        return entries.sort(([a], [b]) => b.localeCompare(a)).map(([w]) => w);
      case 'time':
      default:
        return entries.sort(([, a], [, b]) => (b.savedAt ?? 0) - (a.savedAt ?? 0)).map(([w]) => w);
    }
  });

  vocabCount = computed(() => Object.keys(this.vocabulary()).length);

  vocabDate(word: string): string | null {
    const savedAt = this.vocabulary()[word.toLowerCase()]?.savedAt;
    if (!savedAt) return null;
    const d = new Date(savedAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  }

  ngOnInit(): void {
    this.requestHubAuth();
    this.storageService.getVocabulary().then(v => this.vocabulary.set(v));
  }

  ngOnDestroy(): void {
    if (this._hubMessageHandler) {
      window.removeEventListener('message', this._hubMessageHandler);
    }
    if (this.hubAuthTimer !== null) {
      clearTimeout(this.hubAuthTimer);
      this.hubAuthTimer = null;
    }
  }

  private requestHubAuth(): void {
    const params = new URLSearchParams(window.location.search);
    this.hubOrigin = params.get('hub');
    if (!this.hubOrigin && window !== window.parent) {
      try {
        const ref = document.referrer;
        if (ref) this.hubOrigin = new URL(ref).origin;
      } catch { /* empty */ }
    }

    if (!this.hubOrigin && window === window.parent) {
      console.warn('[dictionary-sub-app] Not inside an iframe and no ?hub= param — skipping Hub auth');
      this.isHubAuth.set(false);
      this.hubMessage.set('Not connected to The Hub.');
      return;
    }

    // WebKit (e.g. Orion) strips document.referrer for cross-origin iframes,
    // so the referrer fast-path above may leave hubOrigin null even when
    // embedded. Fall back to a discovery handshake: post to the parent with
    // targetOrigin '*', adopt the origin of the first matching reply, then
    // pin all further traffic to it. The Hub only replies to whitelisted
    // origins, so the reply origin is trustworthy.
    const isDiscovery = !this.hubOrigin;
    if (isDiscovery) {
      console.log('[dictionary-sub-app] No ?hub= param and no referrer — starting parent-origin discovery handshake');
    } else {
      console.log('[dictionary-sub-app] hubOrigin =', this.hubOrigin);
    }

    // Real Hub protocol: send an RPC-style request, match the reply by requestId.
    const requestId = crypto.randomUUID();
    this._hubMessageHandler = (event: MessageEvent) => {
      const raw = event.data as Record<string, unknown> | undefined;
      if (raw && typeof raw === 'object' && 'requestId' in raw) {
        console.log('[dictionary-sub-app] message from hub:', { origin: event.origin, type: raw['type'], requestId: raw['requestId'], ok: raw['ok'], hasData: 'data' in raw });
      }
      const data = event.data as { requestId?: string; ok?: boolean; data?: { id?: string; name?: string; email?: string; image?: string | null } } | undefined;
      if (!data || data.requestId !== requestId || typeof data.ok !== 'boolean') return;

      if (isDiscovery && !this.hubOrigin) {
        this.hubOrigin = event.origin;
        console.log('[dictionary-sub-app] discovered hub origin from reply:', this.hubOrigin);
      }

      if (event.origin !== this.hubOrigin) return;

      console.log('[dictionary-sub-app] auth response:', { ok: data.ok, data: data.data });

      if (this.hubAuthTimer !== null) {
        clearTimeout(this.hubAuthTimer);
        this.hubAuthTimer = null;
      }
      window.removeEventListener('message', this._hubMessageHandler!);
      this._hubMessageHandler = null;

      const user = data.data;
      if (data.ok && user?.id) {
        this.isHubAuth.set(true);
        this.hubMessage.set(`Connected as ${user.name}`);
        this.storageService.setAuthState(true);
        this.storageService.getVocabulary().then(v => this.vocabulary.set(v));
      } else {
        this.isHubAuth.set(false);
        this.hubMessage.set('Vocabulary is stored locally (not synced across devices).');
        this.storageService.setAuthState(false);
      }
    };

    window.addEventListener('message', this._hubMessageHandler);
    console.log('[dictionary-sub-app] posting auth:getUserInfo →', this.hubOrigin ?? '*', { requestId });
    window.parent.postMessage(
      { type: 'auth:getUserInfo', requestId, version: 1 },
      this.hubOrigin ?? '*'
    );

    this.hubAuthTimer = setTimeout(() => {
      console.warn('[dictionary-sub-app] auth:getUserInfo timed out after 10s — Hub never replied');
      if (this._hubMessageHandler) {
        window.removeEventListener('message', this._hubMessageHandler);
        this._hubMessageHandler = null;
      }
      this.isHubAuth.set(false);
      this.hubMessage.set('Vocabulary is stored locally (not synced across devices).');
      this.storageService.setAuthState(false);
    }, 10000);
  }

  async search() {
    if (!this.searchQuery.trim()) return;
    this.loading.set(true);
    this.error.set(null);

    const result = await this.aiService.lookupWord(this.searchQuery.trim());

    if (result.error) {
      this.error.set(result.error);
      this.result.set(null);
    } else {
      this.result.set(result);
      // Auto-save word to vocabulary on lookup
      await this.storageService.saveWord(this.searchQuery.trim());
      this.vocabulary.set(await this.storageService.getVocabulary());
    }

    this.loading.set(false);
  }

  selectWord(word: string) {
    this.searchQuery = word;
    this.search();
    this.isSidebarOpen.set(false);
  }

  speak(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }
}
