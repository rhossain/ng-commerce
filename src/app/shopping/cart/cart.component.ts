import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export default class CartComponent {
  faBagShopping = faBagShopping;
  isOpen = false;

  @Input() cartItems: any[] = [];
  @Input() subtotal = 0;
  @Output() cartClosed = new EventEmitter<void>();

  toggleCart() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.cartClosed.emit();
    }
  }

  closeSidebar() {
    this.isOpen = false;
    this.cartClosed.emit();
  }
}
