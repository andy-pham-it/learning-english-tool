import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FlashcardData {
  id: string;
  english: string;
  vietnamese: string;
  example: string;
  exampleTranslation?: string;
  category: string;
  difficulty: string;
}

@Component({
  selector: 'app-flashcard-3d',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flashcard-3d.component.html',
  styleUrls: ['./flashcard-3d.component.css']
})
export class Flashcard3dComponent implements OnChanges {
  @Input() data!: FlashcardData;
  @Output() onGrade = new EventEmitter<number>();
  
  displayData!: FlashcardData;
  isFlipped = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      if (!this.isAnimatingFlipBack) {
        this.displayData = this.data;
      }
    }
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    if (this.isFlipped && this.displayData?.english) {
      this.playAudio(this.displayData.english);
    }
  }

  isBlurring = false;
  isAnimatingFlipBack = false;

  gradeCard(grade: number, event: Event) {
    event.stopPropagation(); // Prevent flipping back immediately
    
    // Enable blur effect to hide the next card's content before flipping
    this.isBlurring = true;
    this.isAnimatingFlipBack = true;
    
    this.onGrade.emit(grade);
    
    // Start flipping back to front
    this.isFlipped = false; 
    
    // Remove blur and swap to new card data after the back face is naturally hidden (90deg)
    setTimeout(() => {
      this.isBlurring = false; 
      this.isAnimatingFlipBack = false;
      if (this.data) {
        this.displayData = this.data;
      }
    }, 300);
  }

  playAudio(text: string) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }
}
