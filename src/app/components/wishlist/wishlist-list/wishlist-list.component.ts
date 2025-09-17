// components/wishlist/wishlist-list/wishlist-list.component.ts - Fixed TypeScript errors
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHeart, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { WishlistService } from '../../../services/wishlist.service';
import { AuthService } from '../../../services/auth.service';
import { WishlistWithProduct } from '../../../models/wishlist.model';
import { ProductModel } from '../../../models/product.model';
import { CardComponent } from '../../../product/card/card.component';

@Component({
  selector: 'app-wishlist-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FontAwesomeModule,
    CardComponent
  ],
  templateUrl: './wishlist-list.component.html',
  styleUrl: './wishlist-list.component.scss'
})
export class WishlistListComponent implements OnInit, OnDestroy {
  wishlistItems: WishlistWithProduct[] = [];
  wishlistCount = 0;
  loading = true;
  
  // Icons
  faHeart = faHeart;
  faTrash = faTrash;
  
  private subscriptions = new Subscription();

  constructor(
    private wishlistService: WishlistService,
    public authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadWishlist();
    
    // Subscribe to wishlist changes
    this.subscriptions.add(
      this.wishlistService.wishlist$.subscribe(items => {
        this.wishlistItems = items;
        this.wishlistCount = items.length;
        this.loading = false;
      })
    );

    this.subscriptions.add(
      this.wishlistService.wishlistCount$.subscribe(count => {
        this.wishlistCount = count;
      })
    );

    // Subscribe to loading state
    this.subscriptions.add(
      this.wishlistService.loading$.subscribe(isLoading => {
        this.loading = isLoading;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadWishlist() {
    if (this.authService.isLoggedIn()) {
      this.wishlistService.loadUserWishlist();
    } else {
      this.loading = false;
    }
  }

  removeItem(wishlistId: number, productName: string) {
    if (confirm(`Are you sure you want to remove "${productName}" from your wishlist?`)) {
      this.wishlistService.removeWishlistItem(wishlistId).subscribe({
        next: () => {
          this.toastr.success('Item removed from wishlist', 'Removed');
        },
        error: (error: any) => { // Fixed: Added explicit type annotation
          console.error('Error removing item:', error);
          this.toastr.error('Failed to remove item from wishlist', 'Error');
        }
      });
    }
  }

  clearWishlist() {
    if (confirm('Are you sure you want to clear your entire wishlist?')) {
      this.wishlistService.clearWishlist().subscribe({
        next: () => {
          this.toastr.success('Wishlist cleared successfully', 'Cleared');
        },
        error: (error: any) => { // Fixed: Added explicit type annotation
          console.error('Error clearing wishlist:', error);
          this.toastr.error('Failed to clear wishlist', 'Error');
        }
      });
    }
  }

  // Helper method to extract ProductModel from WishlistWithProduct
  getProductModel(item: WishlistWithProduct): ProductModel | null {
    return item.product || null;
  }

  // Get the wishlist item ID for removal
  getWishlistId(item: WishlistWithProduct): number {
    return item.id;
  }

  // Track by function for performance
  trackByWishlistId(index: number, item: WishlistWithProduct): number {
    return item.id;
  }

  // Helper method to get product name safely
  getProductName(item: WishlistWithProduct): string {
    return item.product?.name || 'Unknown Product';
  }

  // Helper method to check if product data is available
  hasProductData(item: WishlistWithProduct): boolean {
    return !!item.product;
  }
}