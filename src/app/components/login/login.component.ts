import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private toastrService: ToastrService
  ) {}

  login(): void {
    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.authService.saveToken(res.authToken);
        this.toastrService.success('Login successful', 'Welcome');
        this.router.navigate(['/']);
      },
      error: () => this.toastrService.error('Login failed', 'Error'),
    });
  }
}
