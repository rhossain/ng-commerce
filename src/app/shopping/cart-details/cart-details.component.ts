import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RouterModule } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart.model';
import { QuantitySelectorComponent } from '../../shared/quantity-selector/quantity-selector.component';

@Component({
  selector: 'app-cart-details',
  standalone: true,
  imports: [CommonModule, RouterModule, QuantitySelectorComponent],
  templateUrl: './cart-details.component.html',
  styleUrl: './cart-details.component.scss'
})
export default class CartDetailsComponent {
  cartItems$: Observable<CartItem[]>;
  subtotal$: Observable<number>;

  // Default fallback image path
  fallbackUrl = 'assets/images/image-not-loaded.jpg';

  constructor(
      private cartService: CartService
  ) {
    this.cartItems$ = this.cartService.cartItems$;
    this.subtotal$ = this.cartService.subtotal$;
  }

  trackByItem(index: number, item: CartItem): string {
    return `${item.product.id}-${item.variant.id}`;
  }

  updateCartQuantity(item: CartItem, newQuantity: number) {
    this.cartService.updateQuantity(item.product.id, item.variant.id, newQuantity);
  }

  removeItem(item: CartItem) {
    this.cartService.removeFromCart(
      item.product.id,
      item.variant.id
    );
  }

  clearCart() {
    this.cartService.clearCart();
  }
}
