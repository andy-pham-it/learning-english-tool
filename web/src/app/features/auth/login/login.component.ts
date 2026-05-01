import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  async login() {
    try {
      await this.authService.loginWithGoogle();
      this.router.navigate(['/flashcards']); // Default landing after login
    } catch (error) {
      console.error('Login failed:', error);
      alert('Đăng nhập thất bại. Vui lòng check config Firebase.');
    }
  }
}
