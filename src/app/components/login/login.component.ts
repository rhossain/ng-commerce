import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  userEmail = '';
  userPassword = '';

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private toastrService: ToastrService
  ) {}

  login(): void {
    this.authService.login(this.userEmail, this.userPassword).subscribe({
      next: (res) => {
        this.authService.saveToken(res.authToken);
        this.toastrService.success('Login successful', 'Welcome');
        this.router.navigate(['/']);
      },
      error: () => this.toastrService.error('Login failed', 'Error'),
    });
  }
}
