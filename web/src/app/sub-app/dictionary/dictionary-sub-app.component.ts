import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryAiService } from './dictionary-ai.service';
import { DictionaryStorageService } from './dictionary-storage.service';
import { DictionaryResult, VocabItem } from './models';
import type { HubClient } from './lib/hub-client';

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
  private hubClient: HubClient | null = null;
  private themeUnsubscribe?: () => void;

  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  history = signal<string[]>([]);
  vocabulary = signal<Record<string, VocabItem>>({});
  isSidebarOpen = signal(false);
  sortBy = signal<'alpha' | 'time'>('time');
  userName = signal('');

  sortedHistory = computed(() => {
    const list = [...this.history()];
    if (this.sortBy() === 'alpha') {
      return list.sort((a, b) => a.localeCompare(b));
    }
    return list;
  });

  vocabWords = computed(() => Object.keys(this.vocabulary()));

  isSaved = computed(() => {
    const currentWord = this.result()?.word?.toLowerCase();
    return currentWord ? currentWord in this.vocabulary() : false;
  });

  async ngOnInit() {
    this.history.set(await this.storageService.getHistory());
    this.vocabulary.set(await this.storageService.getVocabulary());

    void this.initHubClient();
  }

  private async initHubClient() {
    try {
      const { createHubClient } = await import('./lib/hub-client');
      this.hubClient = createHubClient({ hubOrigin: window.location.origin });

      const user = await this.hubClient.auth.getUserInfo();
      this.userName.set(user.name);

      this.themeUnsubscribe = this.hubClient.events.on('theme-changed', (payload: any) => {
        document.documentElement.classList.toggle('dark', payload.theme === 'dark');
      });
    } catch {
      // Hub optional — running standalone is fine
    }
  }

  ngOnDestroy() {
    this.themeUnsubscribe?.();
    this.hubClient?.destroy();
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
      await this.storageService.addToHistory(this.searchQuery.trim());
      this.history.set(await this.storageService.getHistory());

      void this.publishLookup(result);
    }

    this.loading.set(false);
  }

  private async publishLookup(result: DictionaryResult) {
    if (!this.hubClient) return;
    try {
      await this.hubClient.storage.set('dictionary_last_lookup', {
        word: result.word,
        phonetic: result.phonetic,
        timestamp: Date.now(),
      });
    } catch {
      // optional publish
    }
  }

  selectWord(word: string) {
    this.searchQuery = word;
    this.search();
    this.isSidebarOpen.set(false);
  }

  async saveWord() {
    const word = this.result()?.word;
    if (!word) return;
    await this.storageService.saveWord(word);
    this.vocabulary.set(await this.storageService.getVocabulary());
  }

  async removeWord(word: string) {
    await this.storageService.removeWord(word);
    this.vocabulary.set(await this.storageService.getVocabulary());
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
