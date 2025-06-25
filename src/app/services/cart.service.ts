import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem } from '../models/cart.model';
import { ProductModel } from '../models/product.model';
import { ProductVariant } from '../models/product.model';
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  cartItems$ = this.cartItemsSubject.asObservable();

  private cartSubject = new BehaviorSubject<number>(0);
  cart$ = this.cartSubject.asObservable();

  private subtotalSubject = new BehaviorSubject<number>(0);
  subtotal$ = this.subtotalSubject.asObservable();

  constructor(private toastr: ToastrService) {
    this.loadCartFromStorage();
  }

  private loadCartFromStorage(): void {
    const storedCart = localStorage.getItem('cart');
    if (storedCart) {
      const cartItems: CartItem[] = JSON.parse(storedCart);
      this.cartItemsSubject.next(cartItems);
      this.getCart();
    }
  }

  private saveCartToStorage(cartItems: CartItem[]): void {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }

  private calculateSubtotal(cartItems: CartItem[]): number {
    return cartItems.reduce((total, item) => {
      const price = item.variant.discountPrice ?? item.variant.price;
      return total + (price * item.quantity);
    }, 0);
  }

  getCart(): void {
    const cartItems = this.cartItemsSubject.value;
    this.cartItemsSubject.next(cartItems);

    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    this.cartSubject.next(totalQuantity);

    const subtotal = this.calculateSubtotal(cartItems);
    this.subtotalSubject.next(subtotal);

    this.saveCartToStorage(cartItems);
  }

  addToCart(product: ProductModel, variant: ProductVariant, quantity: number = 1): void {
    const cartItems = [...this.cartItemsSubject.value];
    const existingItem = cartItems.find(item => item.product.id === product.id && item.variant.id === variant.id);

    if (existingItem) {
      existingItem.quantity += quantity;
      this.toastr.info('Quantity updated in cart', 'Cart Updated');
    } else {
      cartItems.push({ product, variant, quantity });
      this.toastr.success('Item added to cart', 'Cart Updated');
    }

    this.cartItemsSubject.next(cartItems);
    this.getCart();
  }

  updateQuantity(productId: number, variantId: number, newQuantity: number): void {
    const cartItems = [...this.cartItemsSubject.value];
    const item = cartItems.find(ci => ci.product.id === productId && ci.variant.id === variantId);

    if (item && newQuantity > 0) {
      item.quantity = newQuantity;
      this.toastr.info('Quantity updated in cart', 'Cart Updated');
    } else if (item && newQuantity === 0) {
      this.removeFromCart(productId, variantId);
      return;
    }

    this.cartItemsSubject.next(cartItems);
    this.getCart();
  }

  removeFromCart(productId: number, variantId: number): void {
    let cartItems = [...this.cartItemsSubject.value];
    cartItems = cartItems.filter(item => !(item.product.id === productId && item.variant.id === variantId));
    this.toastr.warning('Item removed from cart', 'Cart Updated');

    this.cartItemsSubject.next(cartItems);
    this.getCart();
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.cartSubject.next(0);
    this.subtotalSubject.next(0);
    localStorage.removeItem('cart');
    this.toastr.info('Cart cleared', 'Cart Updated');
  }
}
