import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrderArrangeComponent } from './order-arrange.component';
import { PhraseTemplate } from '../models/phrase.model';
import { PhraseContentService } from '../services/phrase-content.service';
import { signal } from '@angular/core';

describe('OrderArrangeComponent', () => {
  let fixture: ComponentFixture<OrderArrangeComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [OrderArrangeComponent],
      providers: [
        {
          provide: PhraseContentService,
          useValue: {
            chunks: signal([{ id: 'it-meet-b2-01', domain: 'it', context: 'meeting', level: 'B2', english: 'take into consideration', vietnamese: 'v', phonetic: '/p/', role: 'linker', examples: [] }]),
          } as any,
        },
      ],
    });
    fixture = TestBed.createComponent(OrderArrangeComponent);
    const tpl: PhraseTemplate = {
      id: 't', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {subject} {chunk:linker} the load.',
      slots: [{ name: 'subject', role: null, options: ['we', 'you'] }, { name: 'linker', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', tpl);
    fixture.detectChanges();
  });

  it('exposes a shuffled pool of id+text items containing all sequence items', () => {
    const c = fixture.componentInstance;
    const texts = c.pool().map((p) => p.text).sort();
    expect(texts).toEqual(['take into consideration', 'we']);
    expect(new Set(c.pool().map((p) => p.id)).size).toBe(2);
  });

  it('validates the picked order via id lookup', () => {
    const c = fixture.componentInstance;
    const idOf = (text: string) => c.pool().find((p) => p.text === text)!.id;
    c.picked.set([idOf('we'), idOf('take into consideration')]);
    c.check();
    expect(c.verdict()?.correct).toBeTrue();
    c.picked.set([idOf('take into consideration'), idOf('we')]);
    c.check();
    expect(c.verdict()?.correct).toBeFalse();
  });

  it('allows completing a sequence with duplicate chunk texts', () => {
    const c = fixture.componentInstance;
    const dupTpl: PhraseTemplate = {
      id: 'd', domain: 'it', context: 'meeting', level: 'B2', english: 'e', vietnamese: 'v',
      structure: 'It would be better if {chunk:linker1} {chunk:linker2} the load.',
      slots: [{ name: 'linker1', role: 'linker' }, { name: 'linker2', role: 'linker' }],
      example: { en: 'e', vi: 'v' },
    };
    fixture.componentRef.setInput('template', dupTpl);
    fixture.detectChanges();
    expect(c.pool().length).toBe(2);
    expect(new Set(c.pool().map((p) => p.id)).size).toBe(2);
    expect(c.pool().every((p) => p.text === 'take into consideration')).toBeTrue();
    c.tap(c.pool()[0].id);
    expect(c.picked().length).toBe(1);
    expect(c.pool().filter((p) => !c.picked().includes(p.id)).length).toBe(1);
    c.tap(c.pool()[1].id);
    c.check();
    expect(c.verdict()?.correct).toBeTrue();
  });
});
