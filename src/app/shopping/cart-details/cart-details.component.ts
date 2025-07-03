import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping, faXmark } from '@fortawesome/free-solid-svg-icons';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart.model';
import { QuantitySelectorComponent } from '../../shared/quantity-selector/quantity-selector.component';

@Component({
  selector: 'app-cart-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, QuantitySelectorComponent],
  templateUrl: './cart-details.component.html',
  styleUrl: './cart-details.component.scss'
})
export default class CartDetailsComponent {
  cartItems$: Observable<CartItem[]>;
  selectedQuantity: number = 1;
  subtotal$: Observable<number>;

  faBagShopping = faBagShopping;
  faXmark = faXmark;

  // Default fallback image path
  fallbackUrl = 'assets/images/image-not-loaded.jpg';

  constructor(
      private cartService: CartService,
      private toastr: ToastrService
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

  onQuantityChange(newQuantity: number) {
    this.selectedQuantity = newQuantity;
    // console.log('Selected Quantity:', this.selectedQuantity);
  }

  onStockOut() {
    this.toastr.warning('Stock is fully reserved!');
  }

  clearCart() {
    this.cartService.clearCart();
  }
}
