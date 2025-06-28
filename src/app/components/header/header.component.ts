import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBarsStaggered, faMagnifyingGlass, faUser } from '@fortawesome/free-solid-svg-icons';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SearchComponent } from "../search/search.component";
import { CartComponent } from "../../shopping/cart/cart.component";
import { NavbarComponent } from "../navbar/navbar.component";
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { SidebarService } from '../../services/sidebar.service';
import { SidebarComponent } from "../sidebar/sidebar.component";
import { FeaturedCategoryComponent } from "../../product/featured-category/featured-category.component";
import { ProductCategory } from '../../models/category.model';
import { AuthService } from '../../services/auth.service';
import { CharInitialsPipe } from "../../shared/char-initials.pipe";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, NgbDropdownModule, SearchComponent, CartComponent, NavbarComponent, SidebarComponent, FeaturedCategoryComponent, CharInitialsPipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  categories: ProductCategory[] = [];
  isLoggedIn = false;
  firstName: string | null = null;
  lastName: string | null = null;
  
  // Icons
  faBarsStaggered = faBarsStaggered;
  faMagnifyingGlass = faMagnifyingGlass;
  faUser = faUser;

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
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      this.isLoggedIn = this.authService.isLoggedIn();
      if (user) {
        this.firstName = user.first_name;
        this.lastName = user.last_name;
      } else {
        this.firstName = null;
        this.lastName = null;
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

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
