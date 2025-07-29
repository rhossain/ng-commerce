// navbar.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faListUl, faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { RouteUtilsService } from '../../services/route-utils.service';
import { UnderDevelopmentDirective } from '../../shared/under-development.directive';

interface CategoryWithCount extends ProductCategory {
  productCount: number;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, UnderDevelopmentDirective, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  faListUl = faListUl;
  faPlus = faPlus;
  faMinus = faMinus;

  categories: CategoryWithCount[] = [];
  filteredCategories: CategoryWithCount[] = [];
  initialVisibleCount = 5;
  showAll = false;
  searchTerm = '';
  currentUrl$;
  isHomePage$;
  fallbackImageUrl = 'assets/images/category-placeholder.svg';

  // Dropdown state
  isDropdownOpen = false;

  private destroy$ = new Subject<void>();

  constructor(
    private categoryService: CategoryService,
    public routeUtils: RouteUtilsService
  ) {
    this.currentUrl$ = this.routeUtils.currentUrl$;
    this.isHomePage$ = this.routeUtils.isCurrentRoute('/home');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Close dropdown when clicking outside
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.dropdown');
    if (!dropdown || !dropdown.contains(target)) {
      this.isDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    this.loadCategoriesWithCounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDropdownToggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  loadCategoriesWithCounts(): void {
    // Load both categories and product counts
    forkJoin({
      categories: this.categoryService.getAllCategories(),
      counts: this.categoryService.getCategoryProductCounts()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ categories, counts }) => {
        // Create a map for faster lookup
        const countMap = new Map<number, number>();
        counts.forEach(c => countMap.set(c.category_id, c.count));

        // Add product counts to categories
        this.categories = categories.map(cat => ({
          ...cat,
          productCount: countMap.get(cat.id) || 0
        }));

        this.filteredCategories = [...this.categories];
        console.log('Categories with counts loaded:', this.categories);
      },
      error: (err) => {
        console.error('Failed to load categories', err);
        // Fallback to just categories without counts
        this.categoryService.getAllCategories().subscribe({
          next: (categories) => {
            this.categories = categories.map(cat => ({
              ...cat,
              productCount: 0
            }));
            this.filteredCategories = [...this.categories];
          },
          error: (error) => console.error('Failed to load categories fallback', error)
        });
      }
    });
  }

  getFilteredCategories(): CategoryWithCount[] {
    if (!this.searchTerm) {
      return this.showAll ? this.categories : this.categories.slice(0, this.initialVisibleCount);
    }
    return this.filteredCategories;
  }

  onSearchChange(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCategories = [...this.categories];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredCategories = this.categories.filter(category =>
        category.name.toLowerCase().includes(term)
      );
    }
  }

  toggleShowAll(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.showAll = !this.showAll;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
    
    // Also remove Bootstrap's show class if present
    setTimeout(() => {
      const dropdownElement = document.querySelector('.dropdown-categories-modern');
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

  getCategorySlug(categoryName: string): string {
    return categoryName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .trim();
  }

  getTotalProductCount(): number {
    return this.categories.reduce((total, category) => total + (category.productCount || 0), 0);
  }

  trackByCategory(index: number, category: CategoryWithCount): number {
    return category.id;
  }

  onImageError(event: any): void {
    // Fallback to placeholder image if category image fails to load
    if (event.target) {
      event.target.src = this.fallbackImageUrl;
    }
  }

  // Utility method to get category icon based on name (if needed for fallbacks)
  getCategoryIcon(categoryName: string): string {
    const iconMap: { [key: string]: string } = {
      'bags': '🛍️',
      'car': '🚗',
      'clothing': '👕',
      'electronic': '📱',
      'furniture': '🪑',
      'home': '🏠',
      'laptop': '💻',
      'motorcycle': '🏍️',
      'phone': '📱',
      'shoes': '👟',
      'sports': '⚽'
    };

    const key = categoryName.toLowerCase();
    for (const [mapKey, icon] of Object.entries(iconMap)) {
      if (key.includes(mapKey)) {
        return icon;
      }
    }
    return '📦'; // Default icon
  }
}