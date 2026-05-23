import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DictionaryComponent } from './dictionary.component';
import { DictionaryService } from '../../core/services/dictionary.service';
import { SpeechService } from '../../core/services/speech.service';
import { of } from 'rxjs';

describe('DictionaryComponent', () => {
  let component: DictionaryComponent;
  let fixture: ComponentFixture<DictionaryComponent>;
  let mockDictionaryService: any;
  let mockSpeechService: any;

  beforeEach(async () => {
    mockDictionaryService = {
      lookup: jasmine.createSpy('lookup').and.returnValue(Promise.resolve({ word: 'test', entries: [] })),
      getSavedWords: jasmine.createSpy('getSavedWords').and.returnValue(Promise.resolve([])),
      getPersonalWords: jasmine.createSpy('getPersonalWords').and.returnValue(Promise.resolve([])),
      addToPersonal: jasmine.createSpy('addToPersonal').and.returnValue(Promise.resolve())
    };

    mockSpeechService = {
      speak: jasmine.createSpy('speak')
    };

    await TestBed.configureTestingModule({
      imports: [DictionaryComponent],
      providers: [
        { provide: DictionaryService, useValue: mockDictionaryService },
        { provide: SpeechService, useValue: mockSpeechService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DictionaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle sort mode', () => {
    expect(component.sortBy()).toBe('time');
    component.toggleSort();
    expect(component.sortBy()).toBe('category');
    component.toggleSort();
    expect(component.sortBy()).toBe('alpha');
    component.toggleSort();
    expect(component.sortBy()).toBe('time');
  });

  it('should sort history alphabetically', () => {
    component.history.set([
      { word: 'zebra' },
      { word: 'apple' },
      { word: 'banana' }
    ]);
    component.sortBy.set('alpha');
    const sorted = component.sortedHistory();
    expect(sorted[0].word).toBe('apple');
    expect(sorted[1].word).toBe('banana');
    expect(sorted[2].word).toBe('zebra');
  });
});
