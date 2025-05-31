import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ProductModel, ProductVariant } from '../models/product.model';
import { CartItem } from '../models/cart.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartKey = 'cart';
  private cartSubject = new BehaviorSubject<number>(0);
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  
  // Public observables
  cart$: Observable<number> = this.cartSubject.asObservable();
  cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();
  subtotal$: Observable<number> = this.cartItems$.pipe(
    map(items => items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0))
  );

  constructor(private toastrService: ToastrService) { 
    this.loadInitialCart();
  }

  private loadInitialCart(): void {
    const cartData = localStorage.getItem(this.cartKey);
    const cart: CartItem[] = cartData ? JSON.parse(cartData) : [];
    this.cartItemsSubject.next(cart);
    this.cartSubject.next(cart.length);
  }

  private saveCart(cart: CartItem[]): void {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
  }

  private updateCart(cart: CartItem[]): void {
    this.saveCart(cart);
    this.cartItemsSubject.next(cart);
    this.cartSubject.next(cart.length);
  }

  getCart(): CartItem[] {
    return [...this.cartItemsSubject.value]; // Return a copy of current state
  }

  addToCart(product: ProductModel, variant: ProductVariant, quantity: number = 1): void {
    const currentCart = this.getCart();
    const existingItem = currentCart.find(
      item => item.product.id === product.id && item.variant.id === variant.id
    );

    const updatedCart = existingItem
      ? currentCart.map(item => 
          item.product.id === product.id && item.variant.id === variant.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      : [...currentCart, { product, variant, quantity }];

    this.updateCart(updatedCart);
    this.toastrService.success(`Added ${product.name} to cart`, 'Cart updated');
  }

  updateQuantity(productId: number, variantId: number, newQuantity: number): void {
    if (newQuantity < 1) {
      this.removeFromCart(productId, variantId);
      return;
    }

    const currentCart = this.getCart();
    const itemIndex = currentCart.findIndex(
      item => item.product.id === productId && item.variant.id === variantId
    );

    if (itemIndex > -1) {
      const updatedCart = [...currentCart];
      updatedCart[itemIndex] = { 
        ...updatedCart[itemIndex], 
        quantity: newQuantity 
      };
      
      this.updateCart(updatedCart);
      this.toastrService.info(
        `Quantity updated for ${updatedCart[itemIndex].product.name}`, 
        'Cart updated'
      );
    }
  }

  removeFromCart(productId: number, variantId: number): void {
    const currentCart = this.getCart();
    const updatedCart = currentCart.filter(
      item => !(item.product.id === productId && item.variant.id === variantId)
    );
    
    this.updateCart(updatedCart);
    this.toastrService.info('Item removed from cart', 'Cart updated');
  }

  clearCart(): void {
    this.updateCart([]);
    this.toastrService.success('Cart cleared', 'Cart updated');
  }

  getCartItem(productId: number, variantId: number): CartItem | undefined {
    return this.getCart().find(
      item => item.product.id === productId && item.variant.id === variantId
    );
  }
}