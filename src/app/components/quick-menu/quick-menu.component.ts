import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping, faShop, faUser } from '@fortawesome/free-solid-svg-icons';
import { faHeart } from '@fortawesome/free-regular-svg-icons';
import { AuthService } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-quick-menu',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './quick-menu.component.html',
  styleUrls: ['./quick-menu.component.scss']
})
export class QuickMenuComponent {
  // Icons
  faBagShopping = faBagShopping;
  faHeart = faHeart;
  faShop = faShop;
  faUser = faUser;

  constructor(
    private router: Router,
    private authService: AuthService,
    private toastrService: ToastrService
  ) {}

  // Navigation methods
  navigateToCart(): void {
    this.closeMenu();
    this.router.navigate(['/shopping/cart']);
  }

  navigateToShop(): void {
    this.closeMenu();
    this.router.navigate(['/shop']);
  }

  navigateToWishlist(): void {
    this.closeMenu();
    // TODO: Implement wishlist navigation when ready
    this.toastrService.info('This feature is under development.', 'Info');
  }

  navigateToUser(): void {
    this.closeMenu();
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/profile']);
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  // Close menu by unchecking the checkbox
  private closeMenu(): void {
    const checkbox = document.getElementById('quick-menu-btn') as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = false;
    }
  }

  // Handle overlay click to close menu
  onOverlayClick(): void {
    this.closeMenu();
  }
}