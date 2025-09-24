import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { faHeart as faHeartSolid } from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { WishlistService } from '../../../services/wishlist.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-wishlist-button',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './wishlist-button.component.html',
  styleUrl: './wishlist-button.component.scss'
})
export class WishlistButtonComponent implements OnInit, OnDestroy {
  @Input() productId!: number;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  
  isInWishlist = false;
  isLoading = false;
  faHeartRegular = faHeartRegular;
  faHeartSolid = faHeartSolid;
  
  private subscriptions = new Subscription();

  constructor(
    private wishlistService: WishlistService,
    private authService: AuthService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to wishlist changes
    this.subscriptions.add(
      this.wishlistService.wishlist$.subscribe(wishlist => {
        this.isInWishlist = wishlist.some(item => 
          item.product_id === this.productId || item.product?.id === this.productId
        );
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  toggleWishlist(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authService.isLoggedIn()) {
      this.toastr.info('Please login to add items to your wishlist', 'Login Required');
      this.router.navigate(['/auth/login']);
      return;
    }

    if (this.isLoading) return;

    this.isLoading = true;

    this.wishlistService.toggleWishlist(this.productId).subscribe({
      next: (added) => {
        const message = added ? 'Added to wishlist' : 'Removed from wishlist';
        const title = added ? 'Item Added' : 'Item Removed';
        this.toastr.success(message, title);
      },
      error: (error) => {
        console.error('Error toggling wishlist:', error);
        let errorMessage = 'Failed to update wishlist';
        
        if (typeof error === 'string') {
          if (error === 'Product already in wishlist') {
            errorMessage = 'Product is already in your wishlist';
          } else if (error === 'User not authenticated') {
            errorMessage = 'Please login to continue';
            this.router.navigate(['/auth/login']);
          } else {
            errorMessage = error;
          }
        }
        
        this.toastr.error(errorMessage, 'Error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  getTooltipText(): string {
    if (!this.authService.isLoggedIn()) {
      return 'Login to add to wishlist';
    }
    return this.isInWishlist ? 'Remove from wishlist' : 'Add to wishlist';
  }
}