// cart-details.component.ts - Focused on cart items only
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faShoppingCart, faTruck, faCreditCard, faTrash, faArrowLeft,
  faGift, faPercent, faShieldAlt, faHeart
} from '@fortawesome/free-solid-svg-icons';
import { Subject, Observable } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart.model';
import { ProductVariant } from '../../models/product.model';
import { QuantitySelectorComponent } from '../../shared/quantity-selector/quantity-selector.component';

@Component({
  selector: 'app-cart-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, QuantitySelectorComponent],
  templateUrl: './cart-details.component.html',
  styleUrls: ['./cart-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartDetailsComponent implements OnInit, OnDestroy {
  private destroy$!: Subject<void>;

  // ✅ Observable streams
  cartItems$!: Observable<CartItem[]>;
  cartItemsQuantity$!: Observable<number>;
  subtotal$!: Observable<number>;

  // ✅ Component state
  freeShippingThreshold = 200; // $200 for free shipping
  totalSavings = 0;
  
  // ✅ Performance tracking
  private updatingItems = new Set<string>();

  // ✅ Icons
  faShoppingCart = faShoppingCart;
  faTruck = faTruck;
  faCreditCard = faCreditCard;
  faTrash = faTrash;
  faArrowLeft = faArrowLeft;
  faGift = faGift;
  faPercent = faPercent;
  faShieldAlt = faShieldAlt;
  faHeart = faHeart;

  constructor(
    private cartService: CartService,
    private router: Router,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    // ✅ Initialize in constructor
    this.destroy$ = new Subject<void>();
    this.initializeObservables();
  }

  ngOnInit(): void {
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ Initialize observables after dependency injection
  private initializeObservables(): void {
    this.cartItems$ = this.cartService.cartItems$;
    this.cartItemsQuantity$ = this.cartService.cart$;
    this.subtotal$ = this.cartService.subtotal$;
  }

  private setupSubscriptions(): void {
    // ✅ Calculate total savings
    this.cartItems$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(items => {
      this.totalSavings = items.reduce((total, item) => total + this.getItemSavings(item), 0);
      this.cdr.markForCheck();
    });
  }

  // ✅ Cart Item Management
  updateItemQuantity(item: CartItem, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeItem(item);
      return;
    }

    if (newQuantity > item.variant.stock) {
      this.toastr.warning('Cannot exceed available stock', 'Stock Limit');
      return;
    }

    const itemKey = `${item.product.id}-${item.variant.id}`;
    
    // ✅ Prevent duplicate updates
    if (this.updatingItems.has(itemKey)) {
      return;
    }

    this.updatingItems.add(itemKey);
    
    // ✅ Update cart service
    this.cartService.updateQuantity(item.product.id, item.variant.id, newQuantity);

    // ✅ Clean up after a short delay
    setTimeout(() => {
      this.updatingItems.delete(itemKey);
      this.cdr.markForCheck();
    }, 300);
  }

  removeItem(item: CartItem): void {
    // ✅ Confirm removal for high-value items
    const itemValue = this.calculateItemSubtotal(item);
    if (itemValue > 100) {
      if (!confirm(`Remove ${item.product.name} from cart? (${this.formatCurrency(itemValue)})`)) {
        return;
      }
    }

    this.cartService.removeFromCart(item.product.id, item.variant.id);
  }

  clearCart(): void {
    if (!confirm('Are you sure you want to clear your entire cart?')) {
      return;
    }
    
    this.cartService.clearCart();
  }

  onStockOut(): void {
    this.toastr.warning('Stock is fully reserved!', 'Out of Stock');
  }

  // ✅ Navigation Methods
  proceedToCheckout(): void {
    this.router.navigate(['/shopping/checkout']);
  }

  saveForLater(): void {
    // Implement save for later functionality
    this.toastr.info('Save for later functionality coming soon!', 'Feature Coming Soon');
  }

  // ✅ Helper Methods
  getItemImage(item: CartItem): string {
    return item.variant.product_images?.[0]?.image_url || 
           item.product.main_image_url || 
           'assets/images/image-not-loaded.jpg';
  }

  getVariantDescription(variant: ProductVariant): string {
    if (!variant.optionValues) return '';
    
    return Object.entries(variant.optionValues)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  getItemPrice(variant: ProductVariant): number {
    return variant.discountPrice || variant.price;
  }

  calculateItemSubtotal(item: CartItem): number {
    const price = this.getItemPrice(item.variant);
    return price * item.quantity;
  }

  getItemSavings(item: CartItem): number {
    if (!item.variant.discountPrice || item.variant.discountPrice >= item.variant.price) {
      return 0;
    }
    
    const originalTotal = item.variant.price * item.quantity;
    const discountedTotal = item.variant.discountPrice * item.quantity;
    
    return originalTotal - discountedTotal;
  }

  getStockStatusText(variant: ProductVariant): string {
    if (variant.stock <= 0) return 'Out of Stock';
    if (variant.stock <= 5) return `Only ${variant.stock} left`;
    return 'In Stock';
  }

  getStockBadgeClass(variant: ProductVariant): string {
    if (variant.stock <= 0) return 'badge bg-danger';
    if (variant.stock <= 5) return 'badge bg-warning';
    return 'badge bg-success';
  }

  isUpdating(item: CartItem): boolean {
    const itemKey = `${item.product.id}-${item.variant.id}`;
    return this.updatingItems.has(itemKey);
  }

  // ✅ Free shipping calculation
  getFreeShippingProgress(subtotal: number): number {
    return Math.min(100, (subtotal / this.freeShippingThreshold) * 100);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // ✅ Track by function for performance
  trackByCartItem(index: number, item: CartItem): string {
    return `${item.product.id}-${item.variant.id}`;
  }
}