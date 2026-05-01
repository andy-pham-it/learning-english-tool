import { Injectable } from '@angular/core';
import localforage from 'localforage';

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor() {
    localforage.config({ name: 'ProEnglish', storeName: 'flashcards' });
  }

  async setItem<T>(key: string, value: T): Promise<T> {
    return await localforage.setItem(key, value);
  }

  async getItem<T>(key: string): Promise<T | null> {
    return await localforage.getItem(key);
  }
}
