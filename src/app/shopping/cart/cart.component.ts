import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBagShopping } from '@fortawesome/free-solid-svg-icons';
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent implements OnInit {
  @Input() cartItems: any[] = [];
  @Input() subtotal = 0;
  @Output() cartClosed = new EventEmitter<void>();
  cartItemsQuantity$!: Observable<number>;

  // Icons
  faBagShopping = faBagShopping;
  isOpen = false;

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.cartItemsQuantity$ = this.cartService.cart$;
  }

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
