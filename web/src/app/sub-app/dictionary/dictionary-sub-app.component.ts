import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryAiService } from './dictionary-ai.service';
import { DictionaryStorageService } from './dictionary-storage.service';
import { DictionaryMigrationService } from './dictionary-migration.service';
import { DictionaryResult, VocabItem } from './models';
import type { HubClient } from './lib/hub-client';

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
  private migrationService = inject(DictionaryMigrationService);
  private hubClient: HubClient | null = null;
  private themeUnsubscribe?: () => void;

  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  vocabulary = signal<Record<string, VocabItem>>({});
  isSidebarOpen = signal(false);
  sortBy = signal<SortMode>('time');
  migrationStatus = signal<string | null>(null);
  migrationRunning = signal(false);
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

  isSaved = computed(() => {
    const currentWord = this.result()?.word?.toLowerCase();
    return currentWord ? currentWord in this.vocabulary() : false;
  });

  async ngOnInit() {
    await this.initHubAuth();
    this.vocabulary.set(await this.storageService.getVocabulary());
  }

  ngOnDestroy() {
    this.themeUnsubscribe?.();
    this.hubClient?.destroy();
  }

  private async initHubAuth() {
    try {
      const { createHubClient } = await import('./lib/hub-client');

      let hubOrigin: string | null = null;
      const params = new URLSearchParams(window.location.search);
      hubOrigin = params.get('hub');
      if (!hubOrigin && window !== window.parent) {
        try { hubOrigin = new URL(document.referrer).origin; } catch { /* empty */ }
      }
      if (!hubOrigin) {
        this.hubMessage.set('Not connected to The Hub.');
        return;
      }

      this.hubClient = createHubClient({ hubOrigin, timeout: 5000 });
      const userInfo = await this.hubClient.auth.getUserInfo();

      if (userInfo?.id) {
        this.isHubAuth.set(true);
        this.hubMessage.set(`Connected as ${userInfo.name}`);
        this.storageService.setFirestoreEnabled(true);

        this.themeUnsubscribe = this.hubClient.events.on('theme-changed', ({ theme }: any) => {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        });
      }
    } catch {
      this.hubMessage.set('Vocabulary is stored locally (not synced across devices).');
    }
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

  // TEMPORARY: one-time migration from old per-user collection
  async runMigration() {
    this.migrationRunning.set(true);
    this.migrationStatus.set('Running...');
    try {
      const result = await this.migrationService.migrateToShared();
      this.migrationStatus.set(`Done! Migrated ${result.migrated} words (${result.skipped} duplicates skipped).`);
      this.vocabulary.set(await this.storageService.getVocabulary());
    } catch (err: any) {
      this.migrationStatus.set(`Error: ${err.message}`);
    }
    this.migrationRunning.set(false);
  }
}
