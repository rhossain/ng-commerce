import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  user = {
    userName: '',
    email: '',
    userPassword: '',
    first_name: '',
    last_name: '',
    street: '',
    city: '',
    state: '',
    zip_code: ''
  };

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private toastrService: ToastrService
  ) {}

  register(): void {
    this.authService.register(this.user).subscribe({
      next: () => {
        this.toastrService.success('Registration successful', 'Success');
        this.router.navigate(['/login']);
      },
      error: () => this.toastrService.error('Registration failed', 'Error'),
    });
  }
}
