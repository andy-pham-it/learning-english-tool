import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlashcardData } from '../../models/flashcard.model';

@Component({
  selector: 'app-flashcard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flashcard.component.html',
  styleUrl: './flashcard.component.css'
})
export class FlashcardComponent implements OnChanges {
  @Input({ required: true }) card!: FlashcardData;
  @Output() graded = new EventEmitter<number>();
  
  isFlipped = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['card']) {
      // Small timeout to allow exit animations if we add them later
      setTimeout(() => {
        this.isFlipped = false;
      }, 50);
    }
  }

  flip(): void {
    if (!this.isFlipped) {
      this.isFlipped = true;
    }
  }

  gradeCard(score: number, event: Event): void {
    event.stopPropagation();
    this.graded.emit(score);
  }
}
