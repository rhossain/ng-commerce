import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem } from '../models/cart.model';
import { ProductModel } from '../models/product.model';
import { ProductVariant } from '../models/product.model';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  cartItems$ = this.cartItemsSubject.asObservable();

  private cartSubject = new BehaviorSubject<number>(0);
  cart$ = this.cartSubject.asObservable();

  private subtotalSubject = new BehaviorSubject<number>(0);
  subtotal$ = this.subtotalSubject.asObservable().pipe(
    debounceTime(100), // ✅ Debounce to prevent excessive shipping calculations
    distinctUntilChanged()
  );

  // ✅ Performance optimizations
  private isUpdating = false;
  private pendingUpdates: (() => void)[] = [];

  constructor(
    private toastr: ToastrService
  ) {
    this.loadCartFromStorage();
    
    // ✅ Setup automatic shipping service updates when subtotal changes
    this.subtotal$.subscribe(subtotal => {
      // Only update shipping service if available and subtotal changed
      if (typeof window !== 'undefined' && (window as any).shippingService) {
        (window as any).shippingService.updateCartTotal(subtotal);
      }
    });
  }

  private loadCartFromStorage(): void {
    try {
      const storedCart = localStorage.getItem('cart');
      if (storedCart) {
        const cartItems: CartItem[] = JSON.parse(storedCart);
        this.cartItemsSubject.next(cartItems);
        this.updateCartMetrics();
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
      this.clearCart();
    }
  }

  private saveCartToStorage(cartItems: CartItem[]): void {
    try {
      localStorage.setItem('cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
      this.toastr.error('Failed to save cart changes', 'Storage Error');
    }
  }

  private calculateSubtotal(cartItems: CartItem[]): number {
    return cartItems.reduce((total, item) => {
      const price = item.variant.discountPrice ?? item.variant.price;
      return total + (price * item.quantity);
    }, 0);
  }

  // ✅ Optimized cart update method with batching
  private updateCartMetrics(): void {
    if (this.isUpdating) {
      // Queue the update if one is already in progress
      this.pendingUpdates.push(() => this.updateCartMetrics());
      return;
    }

    this.isUpdating = true;

    const cartItems = this.cartItemsSubject.value;
    
    // Calculate metrics
    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.calculateSubtotal(cartItems);

    // Update subjects
    this.cartSubject.next(totalQuantity);
    this.subtotalSubject.next(subtotal);

    // Save to storage
    this.saveCartToStorage(cartItems);

    // Process any pending updates
    this.isUpdating = false;
    if (this.pendingUpdates.length > 0) {
      const nextUpdate = this.pendingUpdates.shift();
      if (nextUpdate) {
        setTimeout(nextUpdate, 0);
      }
    }
  }

  // ✅ PUBLIC METHOD: Get cart (for backward compatibility)
  getCart(): void {
    // This method exists for compatibility but cart is auto-loaded in constructor
    this.updateCartMetrics();
  }

  // ✅ Get current cart summary (for performance critical operations)
  getCartSummary(): { itemCount: number; subtotal: number; items: CartItem[] } {
    const items = this.cartItemsSubject.value;
    return {
      itemCount: this.cartSubject.value,
      subtotal: this.subtotalSubject.value,
      items: [...items] // Return copy to prevent external mutations
    };
  }

  addToCart(product: ProductModel, variant: ProductVariant, quantity: number = 1): void {
    if (quantity <= 0) {
      this.toastr.warning('Invalid quantity', 'Cart Error');
      return;
    }

    const cartItems = [...this.cartItemsSubject.value];
    const existingItem = cartItems.find(item => 
      item.product.id === product.id && item.variant.id === variant.id
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      this.toastr.info('Quantity updated in cart', 'Cart Updated');
    } else {
      cartItems.push({ product, variant, quantity });
      this.toastr.success('Item added to cart', 'Cart Updated');
    }

    this.cartItemsSubject.next(cartItems);
    this.updateCartMetrics();
  }

  updateQuantity(productId: number, variantId: number, newQuantity: number): void {
    if (newQuantity < 0) {
      this.toastr.warning('Invalid quantity', 'Cart Error');
      return;
    }

    const cartItems = [...this.cartItemsSubject.value];
    const item = cartItems.find(ci => ci.product.id === productId && ci.variant.id === variantId);

    if (!item) {
      this.toastr.warning('Item not found in cart', 'Cart Error');
      return;
    }

    if (newQuantity === 0) {
      this.removeFromCart(productId, variantId);
      return;
    }

    item.quantity = newQuantity;
    this.toastr.info('Quantity updated in cart', 'Cart Updated');

    this.cartItemsSubject.next(cartItems);
    this.updateCartMetrics();
  }

  removeFromCart(productId: number, variantId: number): void {
    let cartItems = [...this.cartItemsSubject.value];
    const initialLength = cartItems.length;
    
    cartItems = cartItems.filter(item => 
      !(item.product.id === productId && item.variant.id === variantId)
    );

    if (cartItems.length === initialLength) {
      this.toastr.warning('Item not found in cart', 'Cart Error');
      return;
    }

    this.toastr.warning('Item removed from cart', 'Cart Updated');
    this.cartItemsSubject.next(cartItems);
    this.updateCartMetrics();
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.cartSubject.next(0);
    this.subtotalSubject.next(0);
    localStorage.removeItem('cart');
    this.toastr.info('Cart cleared', 'Cart Updated');
  }

  // ✅ Get item quantity by product and variant
  getItemQuantity(productId: number, variantId: number): number {
    const item = this.cartItemsSubject.value.find(item =>
      item.product.id === productId && item.variant.id === variantId
    );
    return item ? item.quantity : 0;
  }

  // ✅ Check if item exists in cart
  isInCart(productId: number, variantId: number): boolean {
    return this.cartItemsSubject.value.some(item =>
      item.product.id === productId && item.variant.id === variantId
    );
  }

  // ✅ Get cart item count
  getItemCount(): number {
    return this.cartSubject.value;
  }

  // ✅ Get cart subtotal
  getSubtotal(): number {
    return this.subtotalSubject.value;
  }

  // ✅ Check if cart is empty
  isEmpty(): boolean {
    return this.cartItemsSubject.value.length === 0;
  }

  // ✅ Get unique product count (different from total quantity)
  getUniqueProductCount(): number {
    return this.cartItemsSubject.value.length;
  }

  // ✅ Batch update multiple items (for performance)
  batchUpdateCart(updates: Array<{ productId: number; variantId: number; quantity: number }>): void {
    const cartItems = [...this.cartItemsSubject.value];
    let hasChanges = false;

    updates.forEach(update => {
      const item = cartItems.find(ci => 
        ci.product.id === update.productId && ci.variant.id === update.variantId
      );
      
      if (item && item.quantity !== update.quantity) {
        if (update.quantity <= 0) {
          const index = cartItems.indexOf(item);
          cartItems.splice(index, 1);
        } else {
          item.quantity = update.quantity;
        }
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.cartItemsSubject.next(cartItems);
      this.updateCartMetrics();
      this.toastr.success('Cart updated', 'Success');
    }
  }

  // ✅ Force refresh cart (useful for debugging or manual refresh)
  refreshCart(): void {
    this.loadCartFromStorage();
  }

  // ✅ Get cart total value
  getTotalValue(): number {
    return this.subtotalSubject.value;
  }

  // ✅ Get cart items count by category
  getItemCountByCategory(categoryId: number): number {
    return this.cartItemsSubject.value
      .filter(item => item.product.category_id === categoryId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  // ✅ Check if product has variants in cart
  hasProductInCart(productId: number): boolean {
    return this.cartItemsSubject.value.some(item => item.product.id === productId);
  }

  // ✅ Get all variants of a product in cart
  getProductVariantsInCart(productId: number): CartItem[] {
    return this.cartItemsSubject.value.filter(item => item.product.id === productId);
  }

  // ✅ Calculate savings total
  getTotalSavings(): number {
    return this.cartItemsSubject.value.reduce((total, item) => {
      if (item.variant.discountPrice && item.variant.discountPrice < item.variant.price) {
        const savings = (item.variant.price - item.variant.discountPrice) * item.quantity;
        return total + savings;
      }
      return total;
    }, 0);
  }

  // ✅ Get cart weight total (if variants have weight)
  getTotalWeight(): number {
    return this.cartItemsSubject.value.reduce((total, item) => {
      const weight = item.variant.weight || 0;
      return total + (weight * item.quantity);
    }, 0);
  }
}