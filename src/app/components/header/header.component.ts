import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBarsStaggered, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { SearchComponent } from "../search/search.component";
import { CartComponent } from "../../shopping/cart/cart.component";
import { NavbarComponent } from "../navbar/navbar.component";
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { SidebarComponent } from "../sidebar/sidebar.component";
import { FeaturedCategoryComponent } from "../../product/featured-category/featured-category.component";
import { ProductCategory } from '../../models/category.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, SearchComponent, CartComponent, NavbarComponent, SidebarComponent, FeaturedCategoryComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  categories: ProductCategory[] = [];
  
  // Icons
  faBarsStaggered = faBarsStaggered;
  faMagnifyingGlass = faMagnifyingGlass;

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

  constructor(
    private sidebarService: SidebarService,
    public router: Router,
    private route: ActivatedRoute, 
  ) {}

  isHomeRoute(): boolean {
    return this.router.url === '/home';
  }

  toggleNavbarSidebar() {
    this.sidebarService.open('navbarId');
  }

  toggleSearchSidebar() {
    this.sidebarService.open('searchId');
  }

  get subtotal(): number {
    return this.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  onSidebarClosed() {
    console.log('Sidebar closed');
    // Optional: sync UI state, reset backdrop, etc.
  }

  onCategorySelect(categoryId: number | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        categoryId: categoryId ?? null,
        page: 1
      },
      queryParamsHandling: 'merge'
    });
  }
}
