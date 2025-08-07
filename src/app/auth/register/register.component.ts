import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  // ✅ Use exact field names that match Xano database schema
  user = {
    userName: '',       // ✅ This was working correctly
    email: '',          // ✅ This was working correctly
    password: '',       // ✅ Use 'password' instead of 'userPassword'
    first_name: '',     // ✅ This was working correctly
    last_name: '',      // ✅ This was working correctly
    street: '',         // ✅ This was working correctly
    city: '',           // ✅ This was working correctly
    state: '',          // ✅ This was working correctly
    zip_code: ''        // ✅ This was working correctly
  };

  isSubmitting = false;

  constructor(
    private authService: AuthService, 
    private router: Router, 
    private toastrService: ToastrService
  ) {}

  // ✅ Password validation
  validatePassword(): boolean {
    if (!this.user.password || this.user.password.trim().length < 6) {
      this.toastrService.error('Password must be at least 6 characters long', 'Validation Error');
      return false;
    }
    return true;
  }

  // ✅ Email validation
  validateEmail(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.user.email || !emailRegex.test(this.user.email.trim())) {
      this.toastrService.error('Please enter a valid email address', 'Validation Error');
      return false;
    }
    return true;
  }

  // ✅ Zip code validation
  validateZipCode(): boolean {
    const zipCode = this.user.zip_code?.trim() || '';
    if (!zipCode || zipCode.length < 4) {
      this.toastrService.error('Zip code must be at least 4 digits long', 'Validation Error');
      return false;
    }
    // Optional: Check if it contains only numbers
    if (!/^\d+$/.test(zipCode)) {
      this.toastrService.error('Zip code must contain only numbers', 'Validation Error');
      return false;
    }
    return true;
  }

  // ✅ Required fields validation
  validateRequiredFields(): boolean {
    const requiredFields = [
      { field: 'userName', label: 'Username' },       // ✅ Changed back to userName
      { field: 'email', label: 'Email' },
      { field: 'password', label: 'Password' },       // ✅ Keep as password
      { field: 'first_name', label: 'First Name' },
      { field: 'last_name', label: 'Last Name' },
      { field: 'street', label: 'Street' },
      { field: 'city', label: 'City' },
      { field: 'zip_code', label: 'Zip Code' }
    ];

    for (const { field, label } of requiredFields) {
      if (!this.user[field as keyof typeof this.user] || !this.user[field as keyof typeof this.user].trim()) {
        this.toastrService.error(`${label} is required`, 'Validation Error');
        return false;
      }
    }
    return true;
  }

  // ✅ Check if password meets requirements for UI feedback
  isPasswordValid(): boolean {
    return !!(this.user.password && this.user.password.trim().length >= 6);
  }

  // ✅ Check if zip code meets requirements for UI feedback
  isZipCodeValid(): boolean {
    const zipCode = this.user.zip_code?.trim() || '';
    return !!(zipCode && zipCode.length >= 4 && /^\d+$/.test(zipCode));
  }

  // ✅ Check if form is valid
  isFormValid(): boolean {
    return !!(
      this.user.userName?.trim() &&           // ✅ Changed back to userName
      this.user.email?.trim() &&
      this.user.password?.trim() &&           // ✅ Keep as password
      this.user.first_name?.trim() &&
      this.user.last_name?.trim() &&
      this.user.street?.trim() &&
      this.user.city?.trim() &&
      this.user.zip_code?.trim() &&
      this.isPasswordValid() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.user.email.trim())
    );
  }

  register(): void {
    if (this.isSubmitting) return;

    // ✅ Comprehensive validation including zip code
    if (!this.validateRequiredFields()) return;
    if (!this.validateEmail()) return;
    if (!this.validatePassword()) return;
    if (!this.validateZipCode()) return;  // ✅ Add zip code validation

    this.isSubmitting = true;

    // ✅ Clean and prepare data exactly as database expects
    const registrationData = {
      name: this.user.userName.trim(),
      email: this.user.email.trim().toLowerCase(),
      password: this.user.password.trim(),
      first_name: this.user.first_name.trim(),
      last_name: this.user.last_name.trim(),
      street: this.user.street.trim(),
      city: this.user.city.trim(),
      state: this.user.state.trim(),
      zip_code: this.user.zip_code.trim()
    };

    console.log('🚀 Registering user with cleaned data:', registrationData);
    
    this.authService.register(registrationData).subscribe({
      next: (response) => {
        console.log('✅ Registration successful:', response);
        this.toastrService.success('Registration successful! Please log in.', 'Welcome!');
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('❌ Registration error:', error);
        this.handleRegistrationError(error);
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  private handleRegistrationError(error: any): void {
    let errorMessage = 'Registration failed. Please try again.';
    let errorTitle = 'Registration Error';

    // ✅ Handle specific error responses including 403
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    switch (error.status) {
      case 400:
        errorTitle = 'Invalid Data';
        errorMessage = 'Please check all required fields are filled correctly.';
        break;
      case 403:
        errorTitle = 'Access Denied';
        errorMessage = 'Registration endpoint access denied. Please contact support.';
        console.error('🚫 403 Error Details:', {
          url: error.url,
          headers: error.headers,
          error: error.error
        });
        break;
      case 409:
        errorTitle = 'Account Exists';
        errorMessage = 'An account with this email already exists.';
        break;
      case 422:
        errorTitle = 'Validation Error';
        errorMessage = 'Please check your input data.';
        break;
      case 500:
        errorTitle = 'Server Error';
        errorMessage = 'Server error occurred. Please try again later.';
        break;
      case 0:
        errorTitle = 'Network Error';
        errorMessage = 'Please check your internet connection.';
        break;
    }

    this.toastrService.error(errorMessage, errorTitle);
  }
}