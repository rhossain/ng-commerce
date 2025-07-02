import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping } from '@fortawesome/free-solid-svg-icons';
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { SidebarComponent } from "../../components/sidebar/sidebar.component";
import { CartItem } from '../../models/cart.model';
import { QuantitySelectorComponent } from '../../shared/quantity-selector/quantity-selector.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, SidebarComponent, QuantitySelectorComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  @Output() cartClosed = new EventEmitter<void>();
  cartItems$: Observable<CartItem[]>;
  cartItemsQuantity$: Observable<number>;
  subtotal$: Observable<number>;
  sidebarId = 'shopping-cart';
  isSidebarOpen = false;

  // Default fallback image path
  fallbackUrl = 'https://placehold.co/400x400/48A6A7/FFF?text=Fallback';

  // Icons
  faBagShopping = faBagShopping;

  constructor(
    private cartService: CartService,
    private sidebarService: SidebarService,
    private router: Router
  ) {
    this.cartItems$ = this.cartService.cartItems$;
    this.cartItemsQuantity$ = this.cartService.cart$;
    this.subtotal$ = this.cartService.subtotal$;
  }

  ngOnInit(): void {
    // Initialize cart data
    this.cartService.getCart();

    // Initialize sidebar position immediately
    this.sidebarService.open(this.sidebarId, {
      title: 'Shopping Cart',
      position: 'right',
      width: '350px'
    });
    this.sidebarService.close(this.sidebarId);

    this.sidebarService.sidebarState$.subscribe(state => {
      if (!state.componentId || state.componentId === this.sidebarId) {
        this.isSidebarOpen = state.isOpen;
        if (!state.isOpen) {
          this.cartClosed.emit();
        }
      }
    });
  }

  trackByItem(index: number, item: CartItem): string {
    return `${item.product.id}-${item.variant.id}`;
  }

  toggleCart() {
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

  closeSidebar() {
    this.sidebarService.close(this.sidebarId);
    this.router.navigate(['/shopping/cart']);
    this.cartClosed.emit();
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

  ngOnDestroy() {
    // Clean up when component is destroyed
    this.sidebarService.close(this.sidebarId);
  }
}
