import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SearchComponent } from "../search/search.component";
import { CartComponent } from "../../shopping/cart/cart.component";
import { NavbarComponent } from "../navbar/navbar.component";
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, SearchComponent, CartComponent, NavbarComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  cartItems = [
    {
      name: 'La Bohème Rose Gold',
      variant: 'Pink',
      image: 'https://via.placeholder.com/60',
      quantity: 2,
      price: 40,
      oldPrice: 60
    },
    {
      name: 'Blush Beanie',
      variant: 'Grey / S',
      image: 'https://via.placeholder.com/60',
      quantity: 5,
      price: 20
    }
  ];

  constructor(public router: Router) {}

  isHomeRoute(): boolean {
    return this.router.url === '/home';
  }

  get subtotal(): number {
    return this.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  onSidebarClosed() {
    console.log('Sidebar closed');
    // Optional: sync UI state, reset backdrop, etc.
  }
}
