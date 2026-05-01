import { Injectable, inject } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);

  // Observable for current user state (Zone.js friendly)
  public user$ = user(this.auth);

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
