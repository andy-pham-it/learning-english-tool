import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  
  // Internal history using Gemini's expected format
  private history: {role: string, parts: {text: string}[]}[] = [];
  
  // Public UI state
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([
    { role: 'model', text: "I have 5 minutes before my next meeting. Give me your progress report, in English." }
  ]);
  public messages$ = this.messagesSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  pushUserMessage(text: string) {
    const currentUi = this.messagesSubject.value;
    this.messagesSubject.next([...currentUi, { role: 'user', text }]);
    this.history.push({ role: 'user', parts: [{ text }] });
  }

  async sendMessage(text: string): Promise<void> {
    this.pushUserMessage(text);
    this.isLoadingSubject.next(true);

    try {
       // Sends the history to our Vercel Serverless Function
       const response = await firstValueFrom(
           this.http.post<{reply: string}>('/api/chat', { messages: this.history })
       );
       
       if (response && response.reply) {
         this.history.push({ role: 'model', parts: [{ text: response.reply }] });
         const currentUi = this.messagesSubject.value;
         this.messagesSubject.next([...currentUi, { role: 'model', text: response.reply }]);
       }
    } catch (e) {
       console.error("Chat API failed. Ensure you are running 'vercel dev' instead of 'ng serve'.", e);
       const currentUi = this.messagesSubject.value;
       this.messagesSubject.next([...currentUi, { role: 'model', text: '[System Error]: Connection to Boss failed. Make sure to run the app via Vercel Dev.' }]);
       this.history.pop(); // Revert user message from history
    } finally {
       this.isLoadingSubject.next(false);
    }
  }

  clearChat() {
    this.history = [];
    this.messagesSubject.next([
      { role: 'model', text: "I have 5 minutes before my next meeting. Give me your progress report, in English." }
    ]);
  }
}
