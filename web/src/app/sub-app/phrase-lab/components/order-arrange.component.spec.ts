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

  it('exposes a shuffled pool containing all sequence items', () => {
    const c = fixture.componentInstance;
    const seq = ['we', 'take into consideration'];
    expect(c.pool().sort()).toEqual(seq.sort());
  });

  it('validates the picked order', () => {
    const c = fixture.componentInstance;
    c.picked.set(['we', 'take into consideration']);
    c.check();
    expect(c.verdict()?.correct).toBeTrue();
    c.picked.set(['take into consideration', 'we']);
    c.check();
    expect(c.verdict()?.correct).toBeFalse();
  });
});
