import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChunkBrowserComponent } from './chunk-browser.component';
import { PhraseContentService } from '../services/phrase-content.service';

describe('ChunkBrowserComponent', () => {
  let fixture: ComponentFixture<ChunkBrowserComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ChunkBrowserComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            domains: signal(['it']),
            contexts: signal(['meeting']),
            levels: signal(['B2']),
            chunks: signal([]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(ChunkBrowserComponent);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
