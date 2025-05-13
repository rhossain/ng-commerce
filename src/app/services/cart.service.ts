import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ProductModel, ProductVariant } from '../models/product.model';
import { CartItem } from '../models/cart.model';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartKey = 'cart';
  private cartSubject = new BehaviorSubject<number>(0);
  cart$: Observable<number> = this.cartSubject.asObservable();

  constructor(private toastrService: ToastrService) { }

  private saveCart(cart: CartItem[]):void {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
  }

  getCart(): CartItem[] {
    const cartData = localStorage.getItem(this.cartKey);
    const cart: CartItem[] = cartData ? JSON.parse(cartData) : [];
    this.cartSubject.next(cart.length);
    return cart;
  }  

  addToCart(product: ProductModel, variant: ProductVariant): void {
    const cart = this.getCart();
  
    const existingItem = cart.find(
      (item) =>
        item.product.id === product.id && item.variant.id === variant.id
    );
  
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({ product, variant, quantity: 1 });
    }
  
    this.saveCart(cart);
    this.cartSubject.next(cart.length);
    this.toastrService.success(`Added ${product.name} to cart`, `Cart updated`);
  }  

  clearCart():void {
    this.saveCart([]);
  }

  removeFromCart(productId: number, variantId: number): void {
    const updatedCart = this.getCart().filter(
      (item: CartItem) =>
        !(item.product.id === productId && item.variant.id === variantId)
    );
  
    this.saveCart(updatedCart);
    this.cartSubject.next(updatedCart.length);
    this.toastrService.info(`Item removed from cart`, `Cart updated`);
  }  
}
