import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService, 
    private router: Router,
    private toastr: ToastrService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    if (this.authService.isLoggedIn()) {
      return true;
    }

    // Show appropriate message based on the route
    const routePath = state.url;
    let message = 'Please log in to continue';
    
    if (routePath.includes('/checkout')) {
      message = 'Please log in to proceed with checkout';
    } else if (routePath.includes('/wishlist')) {
      message = 'Please log in to view your wishlist';
    }

    this.toastr.warning(message, 'Authentication Required');
    
    // Redirect to login with return URL
    this.router.navigate(['/auth/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    
    return false;
  }
}