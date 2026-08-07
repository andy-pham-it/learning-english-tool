import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ConversationBuilderComponent } from './conversation-builder.component';
import { Level, PhraseChunk, Role } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { PhraseProgressService } from '../services/phrase-progress.service';
import { SpeechService } from '../../../core/services/speech.service';

function chunk(id: string, role: Role = 'opener', ctx = 'meeting', level: Level = 'A2'): PhraseChunk {
  return {
    id,
    domain: 'it',
    context: ctx,
    level,
    english: `English ${id}`,
    vietnamese: `Tiếng Việt ${id}`,
    phonetic: '/test/',
    role,
    examples: [],
  };
}

describe('ConversationBuilderComponent', () => {
  let fixture: ComponentFixture<ConversationBuilderComponent>;
  let component: ConversationBuilderComponent;
  let chunks: ReturnType<typeof signal<PhraseChunk[]>>;
  let progressStub: jasmine.SpyObj<PhraseProgressService>;
  let speechStub: { speak: jasmine.Spy };

  beforeEach(async () => {
    chunks = signal<PhraseChunk[]>([]);
    progressStub = jasmine.createSpyObj('PhraseProgressService', ['getDueChunks', 'getCoverage', 'reviewChunk']);
    progressStub.getDueChunks.and.returnValue([]);
    progressStub.getCoverage.and.returnValue({});
    progressStub.reviewChunk.and.resolveTo();
    (progressStub as unknown as { progress: ReturnType<typeof signal<unknown>> }).progress = signal(null);
    speechStub = { speak: jasmine.createSpy('speak') };

    await TestBed.configureTestingModule({
      imports: [ConversationBuilderComponent],
      providers: [
        { provide: PhraseContentService, useValue: { chunks, templates: signal([]), loadAll: jasmine.createSpy(), offline: signal(false) } },
        { provide: PhraseProgressService, useValue: progressStub },
        { provide: SpeechService, useValue: speechStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function meetingChunks(): PhraseChunk[] {
    return [
      chunk('a1', 'opener'),
      chunk('l1', 'linker'),
      chunk('l2', 'linker'),
      chunk('l3', 'linker'),
      chunk('f1', 'filler'),
      chunk('c1', 'closer'),
      chunk('r1', 'reaction'),
    ];
  }

  it('assembles a 6-line dialogue in role order when all roles exist', () => {
    chunks.set(meetingChunks());
    component.selectContext('meeting');
    fixture.detectChanges();
    const roles = component.dialogue().map((c) => c.role);
    expect(roles).toEqual(['opener', 'linker', 'linker', 'filler', 'closer', 'reaction']);
    expect(component.dialogue()[0].id).toBe('a1');
  });

  it('falls back to 5 lines when no reaction chunk exists', () => {
    chunks.set(meetingChunks().filter((c) => c.role !== 'reaction'));
    component.selectContext('meeting');
    fixture.detectChanges();
    const roles = component.dialogue().map((c) => c.role);
    expect(roles).toEqual(['opener', 'linker', 'linker', 'filler', 'closer']);
  });

  it('produces a different linker selection on next dialogue', () => {
    chunks.set(meetingChunks());
    component.selectContext('meeting');
    const first = component.dialogue().filter((c) => c.role === 'linker').map((c) => c.id);
    expect(first).toEqual(['l1', 'l2']);
    component.nextDialogue();
    const second = component.dialogue().filter((c) => c.role === 'linker').map((c) => c.id);
    expect(second).toEqual(['l2', 'l3']);
    expect(second).not.toEqual(first);
  });

  it('calls reviewChunk with the chunk id and rating', () => {
    chunks.set(meetingChunks());
    component.selectContext('meeting');
    const c = component.dialogue()[0];
    component.rate(c, 'good');
    expect(progressStub.reviewChunk).toHaveBeenCalledWith(c.id, 'good');
  });

  it('toggles Vietnamese translation visibility', () => {
    chunks.set(meetingChunks());
    component.selectContext('meeting');
    expect(component.showVi()).toBe(false);
    component.toggleVi();
    fixture.detectChanges();
    expect(component.showVi()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Tiếng Việt a1');
  });

  it('shows empty state before a context is selected', () => {
    chunks.set(meetingChunks());
    fixture.detectChanges();
    expect(component.dialogue().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Chọn một chủ đề');
  });

  it('speaks the chunk english on listen', () => {
    chunks.set(meetingChunks());
    component.selectContext('meeting');
    const c = component.dialogue()[0];
    component.listen(c);
    expect(speechStub.speak).toHaveBeenCalledWith(c.english, 'en-US');
  });
});
