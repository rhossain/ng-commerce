import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ProductModel, ProductVariant } from '../../models/product.model';
import { ProductCacheService } from '../../services/product-cache.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-deal-card',
  imports: [CommonModule],
  templateUrl: './deal-card.component.html',
  styleUrls: ['./deal-card.component.scss'],
  standalone: true
})
export class DealCardComponent implements OnInit, OnDestroy {
  @Input() productIds: number[] = [];
  @Input() dealEndTime: string = '2025-06-15T23:59:59';

  products: ProductModel[] = [];
  timeLeft: any = {};
  isLoading = true;
  error: string | null = null;
  
  private intervalId: any;
  private destroy$ = new Subject<void>();

  constructor(
    private productCacheService: ProductCacheService,
    private cartService: CartService
  ) {}
  
  ngOnInit() {
    console.log('DealCardComponent ngOnInit called with productIds:', this.productIds);
    this.loadProducts();
    this.startTimer();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearTimer();
  }

  async loadProducts() {
    this.isLoading = true;
    this.error = null;
    
    try {
      console.log('Loading products for deal card...');
      
      // Ensure cache is loaded first
      await this.productCacheService.ensureCache();
      
      this.productCacheService.getAllProducts()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (allProducts) => {
            console.log('All products loaded:', allProducts.length);
            console.log('Filtering for product IDs:', this.productIds);
            
            this.products = allProducts.filter(p => this.productIds.includes(p.id));
            console.log('Filtered products for deal:', this.products);
            
            this.isLoading = false;
            
            if (this.products.length === 0) {
              console.warn('No products found for the given IDs');
              this.error = 'No products found for this deal';
            }
          },
          error: (error) => {
            console.error('Error loading products:', error);
            this.error = 'Failed to load deal products';
            this.isLoading = false;
          }
        });
    } catch (error) {
      console.error('Error in loadProducts:', error);
      this.error = 'Failed to load deal products';
      this.isLoading = false;
    }
  }

  startTimer() {
    this.updateTime();
    this.intervalId = setInterval(() => this.updateTime(), 1000);
  }

  clearTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  updateTime() {
    const end = new Date(this.dealEndTime).getTime();
    const now = new Date().getTime();
    const diff = Math.max(end - now, 0);

    const format = (val: number) => val.toString().padStart(2, '0');

    this.timeLeft = {
      days: format(Math.floor(diff / (1000 * 60 * 60 * 24))),
      hours: format(Math.floor((diff / (1000 * 60 * 60)) % 24)),
      minutes: format(Math.floor((diff / (1000 * 60)) % 60)),
      seconds: format(Math.floor((diff / 1000) % 60)),
    };

    // Note: Timer continues running even after deal expires for display purposes
  }

  getDiscountPercent(price?: number, discountPrice?: number): number | null {
    if (price == null || discountPrice == null || discountPrice >= price) return null;
    return Math.round(((price - discountPrice) / price) * 100);
  }

  addToCart(product: ProductModel) {
    const variant = product.variants?.[0];
    if (variant) {
      this.cartService.addToCart(product, variant, 1);
    } else {
      console.warn('No variant available for product:', product.name);
    }
  }

  // Helper method for tracking
  trackByFn(index: number, item: ProductModel): number {
    return item.id;
  }

  // Helper method to retry loading
  retry(): void {
    this.loadProducts();
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = 'assets/images/image-not-loaded.jpg';
  }
}