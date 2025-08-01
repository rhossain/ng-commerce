import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping } from '@fortawesome/free-solid-svg-icons';
import { Observable, Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CartService } from '../../services/cart.service';
import { PricingService } from '../../services/pricing.service'; // ← Add this import
import { SidebarService } from '../../services/sidebar.service';
import { SidebarComponent } from "../../components/sidebar/sidebar.component";
import { CartItem } from '../../models/cart.model';
import { ProductVariant } from '../../models/product.model';
import { QuantitySelectorComponent } from '../../shared/quantity-selector/quantity-selector.component';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, SidebarComponent, QuantitySelectorComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush // ✅ Performance optimization
})
export class CartComponent implements OnInit, OnDestroy {
  @Output() cartClosed = new EventEmitter<void>();
  
  // ✅ Fixed property initialization - using definite assignment assertion
  private destroy$!: Subject<void>;
  cartItems$!: Observable<CartItem[]>;
  cartItemsQuantity$!: Observable<number>;
  subtotal$!: Observable<number>;

  // ✅ Component state
  selectedQuantity: number = 1;
  sidebarId = 'shopping-cart';
  isSidebarOpen = false;
  freeShippingThreshold = 200; // $200 for free shipping
  
  // ✅ Performance tracking
  private updatingItems = new Set<string>();

  // Default fallback image path
  fallbackUrl = 'https://placehold.co/400x400/48A6A7/FFF?text=Fallback';

  // Icons
  faBagShopping = faBagShopping;

  constructor(
    private cartService: CartService,
    private sidebarService: SidebarService,
    private router: Router,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    public pricingService: PricingService // ← Add this injection (make it public)
  ) {
    // ✅ Initialize subjects and observables in constructor
    this.destroy$ = new Subject<void>();
    this.initializeObservables();
  }

  ngOnInit(): void {
    this.setupCart();
    this.setupSidebar();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    // ✅ Proper cleanup
    this.destroy$.next();
    this.destroy$.complete();
    this.sidebarService.close(this.sidebarId);
  }

  // ✅ Initialize observables after dependency injection
  private initializeObservables(): void {
    this.cartItems$ = this.cartService.cartItems$;
    this.cartItemsQuantity$ = this.cartService.cart$;
    this.subtotal$ = this.cartService.subtotal$;
  }

  private setupCart(): void {
    // Initialize cart data
    this.cartService.getCart();
  }

  private setupSidebar(): void {
    // Initialize sidebar position immediately
    this.sidebarService.open(this.sidebarId, {
      title: 'Shopping Cart',
      position: 'right',
      width: '350px'
    });
    this.sidebarService.close(this.sidebarId);
  }

  private setupSubscriptions(): void {
    // ✅ Monitor sidebar state
    this.sidebarService.sidebarState$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(state => {
      if (!state.componentId || state.componentId === this.sidebarId) {
        this.isSidebarOpen = state.isOpen;
        if (!state.isOpen) {
          this.cartClosed.emit();
        }
        this.cdr.markForCheck();
      }
    });

    // ✅ Monitor cart changes for optimizations
    this.cartItems$.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => prev.length === curr.length),
      takeUntil(this.destroy$)
    ).subscribe(items => {
      // Auto-close sidebar if cart becomes empty
      if (items.length === 0 && this.isSidebarOpen) {
        // Optional: Auto-close when empty
        // this.sidebarService.close(this.sidebarId);
      }
      this.cdr.markForCheck();
    });
  }

  // ✅ Performance optimized track by function
  trackByItem(index: number, item: CartItem): string {
    return `${item.product.id}-${item.variant.id}`;
  }

  // ✅ Cart Actions
  toggleCart(): void {
    if (this.isSidebarOpen) {
      this.sidebarService.close(this.sidebarId);
    } else {
      this.sidebarService.open(this.sidebarId, {
        title: 'Shopping Cart',
        position: 'right',
        width: '350px'
      });
    }
  }

  closeSidebar(): void {
    this.sidebarService.close(this.sidebarId);
    this.cartClosed.emit();
  }

  viewFullCart(): void {
    this.closeSidebar();
    this.router.navigate(['/shopping/cart']);
  }

  proceedToCheckout(): void {
    this.closeSidebar();
    this.router.navigate(['/shopping/checkout']);
  }

  // ✅ Quantity Management with optimistic updates
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

  onQuantityChange(newQuantity: number): void {
    this.selectedQuantity = newQuantity;
  }

  onStockOut(): void {
    this.toastr.warning('Stock is fully reserved!', 'Out of Stock');
  }

  removeItem(item: CartItem): void {
    // ✅ Confirm removal for high-value items
    const itemValue = this.getItemSubtotal(item);
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

  // ✅ Helper Methods
  getItemImage(item: CartItem): string {
    return item.variant.product_images?.[0]?.image_url || 
           item.product.main_image_url || 
           this.fallbackUrl;
  }

  getVariantDescription(variant: ProductVariant): string {
    if (!variant.optionValues) return '';
    
    return Object.entries(variant.optionValues)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  /**
   * Get item price using PricingService (effective price)
   * @deprecated Use pricingService.getEffectivePrice() directly in template
   */
  getItemPrice(variant: ProductVariant): number {
    return this.pricingService.getEffectivePrice(variant);
  }

  /**
   * Get item subtotal using PricingService
   */
  getItemSubtotal(item: CartItem): number {
    const effectivePrice = this.pricingService.getEffectivePrice(item.variant);
    return effectivePrice * item.quantity;
  }

  /**
   * Get item savings using PricingService
   */
  getItemSavings(item: CartItem): number {
    const pricingInfo = this.pricingService.getVariantPricingInfo(item.variant);
    return pricingInfo.savings * item.quantity;
  }

  /**
   * Check if variant is low stock
   */
  isLowStock(variant: ProductVariant): boolean {
    return variant.stock <= 5 && variant.stock > 0;
  }

  /**
   * Check if item is being updated
   */
  isUpdating(item: CartItem): boolean {
    const itemKey = `${item.product.id}-${item.variant.id}`;
    return this.updatingItems.has(itemKey);
  }

  /**
   * Format currency using PricingService
   * @deprecated Use pricingService.formatPrice() directly in template
   */
  formatCurrency(amount: number): string {
    return this.pricingService.formatPrice(amount);
  }

  // ✅ Free shipping calculation
  getFreeShippingProgress(subtotal: number): number {
    return Math.min(100, (subtotal / this.freeShippingThreshold) * 100);
  }

  getRemainingForFreeShipping(subtotal: number): number {
    return Math.max(0, this.freeShippingThreshold - subtotal);
  }

  qualifiesForFreeShipping(subtotal: number): boolean {
    return subtotal >= this.freeShippingThreshold;
  }

  /**
   * Check if item has valid discount using PricingService
   */
  itemHasDiscount(variant: ProductVariant): boolean {
    return this.pricingService.hasValidDiscount(variant);
  }

  /**
   * Get discount percentage for item using PricingService
   */
  getItemDiscountPercentage(variant: ProductVariant): number {
    return this.pricingService.getDiscountPercentage(variant);
  }

  /**
   * Get cart total savings
   */
  getTotalSavings(): number {
    return this.cartService.getTotalSavings();
  }

  /**
   * Get cart summary with detailed pricing
   */
  getCartSummary(): {
    itemCount: number;
    subtotal: number;
    totalSavings: number;
    originalSubtotal: number;
  } {
    const itemCount = this.cartService.getItemCount();
    const subtotal = this.cartService.getSubtotal();
    const totalSavings = this.getTotalSavings();
    const originalSubtotal = subtotal + totalSavings;

    return {
      itemCount,
      subtotal,
      totalSavings,
      originalSubtotal
    };
  }
}