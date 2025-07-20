import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  userEmail: string = '';
  userPassword: string = '';
  isLoading: boolean = false;
  returnUrl: string = '/';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Get return URL from query params, default to home page
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // If user is already logged in, redirect them
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.userEmail || !this.userPassword) {
      this.toastr.warning('Please fill in all fields');
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.login(this.userEmail, this.userPassword).toPromise();
      
      this.toastr.success('Login successful!');
      
      // Redirect to the intended page or home
      this.router.navigate([this.returnUrl]);
      
    } catch (error) {
      console.error('Login failed:', error);
      this.toastr.error('Invalid email or password');
    } finally {
      this.isLoading = false;
    }
  }

  navigateToRegister(): void {
    // Preserve return URL when going to register
    this.router.navigate(['/auth/register'], {
      queryParams: { returnUrl: this.returnUrl }
    });
  }
}