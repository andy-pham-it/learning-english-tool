import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DictionaryAiService } from './dictionary-ai.service';
import { DictionaryStorageService } from './dictionary-storage.service';
import { DictionaryResult, VocabItem } from './models';

@Component({
  selector: 'app-dictionary-sub-app',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dictionary-sub-app.component.html',
  styleUrls: ['./dictionary-sub-app.component.css'],
})
export class DictionarySubAppComponent implements OnInit {
  private aiService = inject(DictionaryAiService);
  private storageService = inject(DictionaryStorageService);

  searchQuery = '';
  loading = signal(false);
  result = signal<DictionaryResult | null>(null);
  error = signal<string | null>(null);
  history = signal<string[]>([]);
  vocabulary = signal<Record<string, VocabItem>>({});
  isSidebarOpen = signal(false);
  sortBy = signal<'alpha' | 'time'>('time');

  sortedHistory = computed(() => {
    const list = [...this.history()];
    if (this.sortBy() === 'alpha') {
      return list.sort((a, b) => a.localeCompare(b));
    }
    return list;
  });

  vocabWords = computed(() => Object.keys(this.vocabulary()));

  vocabWordsSorted = computed(() => {
    const vocab = this.vocabulary();
    return Object.entries(vocab)
      .sort(([, a], [, b]) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .map(([word]) => word);
  });

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
    this.history.set(await this.storageService.getHistory());
    this.vocabulary.set(await this.storageService.getVocabulary());
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
}
