import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService, ChatMessage } from '../../../../core/services/chat.service';
import { SpeechService } from '../../../../core/services/speech.service';

@Component({
  selector: 'app-bossfight-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: { class: 'block h-full w-full absolute inset-0' },
  template: `
    <div class="h-full w-full bg-[#0B1121] flex flex-col font-sans">
      
      <!-- Top Bar -->
      <div class="h-16 w-full bg-white/5 border-b border-white/10 flex items-center px-4 shrink-0 backdrop-blur-md sticky top-0 z-10">
        <button (click)="goBack()" class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors mr-3 cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        
        <div class="relative">
          <div class="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xl overflow-hidden shadow-[0_0_15px_rgba(244,63,94,0.2)]">
            👔
          </div>
          <div class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0B1121] rounded-full"></div>
        </div>
        
        <div class="ml-3 flex flex-col justify-center">
          <span class="font-bold text-white text-base leading-tight drop-shadow-md">The Manager</span>
          <span class="text-xs text-rose-400 font-medium tracking-wider uppercase">Boss Fight</span>
        </div>
        
        <div class="ml-auto">
          <button (click)="chatService.clearChat()" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors cursor-pointer">Reset</button>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 w-full max-w-3xl mx-auto overflow-y-auto p-4 space-y-6 scroll-smooth scrollbar-thin overflow-x-hidden" #chatContainer>
        
        <div *ngFor="let msg of messages" class="flex w-full" [ngClass]="msg.role === 'user' ? 'justify-end' : 'justify-start'">
           
           <!-- Model Bubble -->
           <div *ngIf="msg.role === 'model'" class="flex max-w-[85%] sm:max-w-[75%] items-start gap-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-sm shadow-[0_0_10px_rgba(244,63,94,0.1)] mt-1 hidden sm:flex">
                👔
              </div>
              <div class="bg-gray-800/80 backdrop-blur-md text-gray-100 rounded-2xl rounded-tl-sm px-5 py-3 border border-white/5 shadow-lg leading-relaxed whitespace-pre-wrap text-[15px]">
                {{ msg.text }}
              </div>
           </div>

           <!-- User Bubble -->
           <div *ngIf="msg.role === 'user'" class="flex max-w-[85%] sm:max-w-[75%] items-end gap-3 flex-row-reverse">
              <div class="bg-indigo-600/90 backdrop-blur-md text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-[0_4px_15px_rgba(79,70,229,0.3)] leading-relaxed whitespace-pre-wrap text-[15px]">
                {{ msg.text }}
              </div>
           </div>
        </div>

        <!-- Typing Indicator -->
        <div *ngIf="isLoading" class="flex w-full justify-start mt-4">
           <div class="flex max-w-[85%] items-start gap-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-sm mt-1 hidden sm:flex">
                👔
              </div>
              <div class="bg-gray-800/80 backdrop-blur-md rounded-2xl rounded-tl-sm px-5 py-4 border border-white/5 shadow-lg flex gap-1.5 items-center justify-center">
                <div class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 300ms"></div>
              </div>
           </div>
        </div>
        
        <!-- Push bottom so it doesn't hide behind input -->
        <div class="h-2 w-full"></div>

      </div>

      <!-- Input Bar -->
      <div class="w-full max-w-3xl mx-auto p-4 shrink-0 bg-gradient-to-t from-[#0B1121] to-transparent pb-[80px]">
        <div class="relative w-full flex items-end gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-2 focus-within:border-indigo-500/50 focus-within:bg-white/10 transition-all shadow-xl">
           
           <textarea 
             [(ngModel)]="userInput" 
             (keydown)="onKeyDown($event)"
             rows="1"
             placeholder="Discuss with the manager..." 
             class="flex-1 bg-transparent text-white px-4 py-3 min-h-[44px] max-h-32 resize-none outline-none placeholder-gray-500 scrollbar-thin disabled:opacity-50"
             [disabled]="isLoading || isListening">
           </textarea>

           <!-- Mic Button -->
           <button 
             class="h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
             [ngClass]="isListening ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'"
             (click)="startListening()" 
             (contextmenu)="$event.preventDefault()"
             [disabled]="isLoading">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
           </button>

           <!-- Send Button -->
           <button 
             (click)="sendMessage()" 
             [disabled]="!userInput.trim() || isLoading"
             class="h-11 w-11 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:bg-white/5 disabled:text-gray-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] cursor-pointer">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
           </button>

        </div>
        
        <div class="text-center mt-2" *ngIf="isListening">
          <span class="text-xs text-rose-400 animate-pulse uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
            <span class="w-2 h-2 rounded-full bg-rose-500"></span> Listening
          </span>
        </div>
      </div>
      
    </div>
  `
})
export class BossfightPageComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  
  private router = inject(Router);
  public chatService = inject(ChatService);
  private speech = inject(SpeechService);

  messages: ChatMessage[] = [];
  isLoading = false;
  userInput = '';
  isListening = false;
  
  private needsScroll = false;

  ngOnInit() {
    this.chatService.messages$.subscribe(msgs => {
      this.messages = msgs;
      this.needsScroll = true;
    });

    this.chatService.isLoading$.subscribe(loading => {
      this.isLoading = loading;
      this.needsScroll = true;
    });
  }

  ngAfterViewChecked() {
    if (this.needsScroll) {
      this.scrollToBottom();
      this.needsScroll = false;
    }
  }

  scrollToBottom() {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  goBack() {
    this.router.navigate(['/minigames']); // or dashboard
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage() {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.userInput = '';
    this.chatService.sendMessage(text);
  }

  async startListening() {
    if (this.isListening || this.isLoading) return;
    
    const isSupported = this.speech.isRecognitionSupported();
    if (!isSupported) {
      alert("Speech Recognition not supported in this browser.");
      return;
    }

    this.isListening = true;
    try {
      const transcript = await this.speech.startListening('en-US');
      this.isListening = false;
      this.userInput = (this.userInput + ' ' + transcript).trim();
    } catch (e) {
      this.isListening = false;
      console.warn("Speech recognition error:", e);
    }
  }
}
