import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faListUl } from '@fortawesome/free-solid-svg-icons';
import { Subject, takeUntil } from 'rxjs';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { RouteUtilsService } from '../../services/route-utils.service';
import { UnderDevelopmentDirective } from '../../shared/under-development.directive';
import { FeaturedCategoryComponent } from '../../product/featured-category/featured-category.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FontAwesomeModule, 
    UnderDevelopmentDirective, 
    FormsModule,
    FeaturedCategoryComponent
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  faListUl = faListUl;

  categories: ProductCategory[] = [];
  totalProductCount = 0;
  currentUrl$;
  isHomePage$;

  // Dropdown state
  isDropdownOpen = false;

  private destroy$ = new Subject<void>();

  constructor(
    private categoryService: CategoryService,
    public routeUtils: RouteUtilsService,
    private router: Router
  ) {
    this.currentUrl$ = this.routeUtils.currentUrl$;
    this.isHomePage$ = this.routeUtils.isCurrentRoute('/home');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.dropdown-categories-enhanced');
    const dropdownTrigger = target.closest('.dropdown-slide');
    
    // Don't close if clicking inside the dropdown content or on the trigger
    if (!dropdown && !dropdownTrigger) {
      this.isDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.categoryService.getAllCategories().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (categories) => {
        this.categories = categories;
        console.log('Categories loaded in navbar:', this.categories);
      },
      error: (err) => {
        console.error('Failed to load categories in navbar', err);
        this.categories = [];
      }
    });
  }

  onDropdownToggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  onCategorySelected(categoryId: number | null): void {
    console.log('Category selected in navbar:', categoryId);
    
    // Close the dropdown first
    this.closeDropdown();
    
    // Navigate to shop page
    if (categoryId) {
      // Navigate to shop with category filter
      this.router.navigate(['/shop'], {
        queryParams: { 
          categoryId: categoryId,
          page: 1 
        }
      });
    } else {
      // Navigate to shop without category filter (all products)
      this.router.navigate(['/shop'], {
        queryParams: { 
          page: 1 
        }
      });
    }
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
    
    // Remove Bootstrap's show class if present
    setTimeout(() => {
      const dropdownElement = document.querySelector('.dropdown-categories-enhanced');
      if (dropdownElement) {
        const dropdown = dropdownElement.closest('.dropdown');
        if (dropdown) {
          dropdown.classList.remove('show');
          const dropdownMenu = dropdown.querySelector('.dropdown-menu');
          if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
          }
        }
      }
    }, 100);
  }

  // Navigation methods for other nav items
  navigateToFlashDeals(): void {
    this.router.navigate(['/shop'], {
      queryParams: { 
        filter: 'flash-deals',
        page: 1 
      }
    });
  }

  navigateToNewArrivals(): void {
    this.router.navigate(['/shop'], {
      queryParams: { 
        filter: 'new-arrivals',
        page: 1 
      }
    });
  }

  navigateToAbout(): void {
    this.router.navigate(['/about']);
  }

  navigateToContact(): void {
    this.router.navigate(['/contact']);
  }

  trackByCategory(index: number, category: ProductCategory): number {
    return category.id;
  }
}