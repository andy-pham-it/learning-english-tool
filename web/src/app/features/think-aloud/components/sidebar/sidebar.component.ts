import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-think-aloud-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full bg-white border-r border-slate-100 flex flex-col w-64">
      <div class="p-6 border-b border-slate-50">
        <h2 class="text-lg font-bold text-slate-800">Think Aloud</h2>
        <p class="text-xs text-slate-400 font-medium">Select a category</p>
      </div>
      
      <div class="flex-1 overflow-y-auto p-4 space-y-1">
        <button *ngFor="let cat of categories"
                (click)="select.emit(cat)"
                [class.bg-indigo-50]="selected === cat"
                [class.text-indigo-600]="selected === cat"
                [class.text-slate-600]="selected !== cat"
                class="w-full text-left px-4 py-3 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all flex justify-between items-center group">
          {{ cat }}
          <span *ngIf="selected === cat" class="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
          <svg *ngIf="selected !== cat" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  `
})
export class SidebarComponent {
  @Input() categories: string[] = [];
  @Input() selected: string = '';
  @Output() select = new EventEmitter<string>();
}
