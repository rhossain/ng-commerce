import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearch, faBox, faExclamationTriangle, faRedo, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { CategoryService } from '../../services/category.service';
import { ProductCategory } from '../../models/category.model';

interface CategoryWithCount extends ProductCategory {
  productCount: number;
}

@Component({
  selector: 'app-featured-category',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, FontAwesomeModule],
  templateUrl: './featured-category.component.html',
  styleUrls: ['./featured-category.component.scss']
})
export class FeaturedCategoryComponent implements OnInit, OnDestroy {
  @Input() styleType: 'default' | 'list' | 'grid' | 'pill' | 'sidebar' = 'default';
  @Input() selectedCategoryId: number | null = null;
  @Input() onlyCategoryIds?: number[];
  @Input() categories: ProductCategory[] = [];
  @Input() navigationMode: 'query' | 'route' | 'custom' = 'custom';
  
  // New inputs for enhanced list style
  @Input() showHeader: boolean = true;
  @Input() headerTitle: string = 'Product Categories';
  @Input() showSearch: boolean = true;
  @Input() searchPlaceholder: string = 'Search categories...';
  @Input() searchThreshold: number = 6;
  @Input() showAllOption: boolean = true;
  @Input() showProductCount: boolean = true;
  @Input() initialVisibleCount: number = 8;
  @Input() showToggleButton: boolean = true; // New: Control show all/less button
  @Input() autoExpandOnMobile: boolean = true; // New: Auto-expand on mobile devices

  @Output() categorySelected = new EventEmitter<number | null>();

  // Component state
  localCategories: CategoryWithCount[] = [];
  filteredCategories: CategoryWithCount[] = [];
  isLoading = true;
  error: string | null = null;
  fallbackImg = 'assets/images/image-not-loaded.jpg';
  searchTerm = '';
  showAll = false;
  isMobileDevice = false; // Track if device is mobile

  // Icons
  faSearch = faSearch;
  faBox = faBox;
  faExclamationTriangle = faExclamationTriangle;
  faRedo = faRedo;
  faChevronDown = faChevronDown;
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    console.log('FeaturedCategoryComponent ngOnInit called');
    console.log('Input categories:', this.categories);
    
    // Detect mobile device
    this.detectMobileDevice();
    
    // Auto-expand on mobile if enabled
    if (this.autoExpandOnMobile && this.isMobileDevice) {
      this.showAll = true;
    }
    
    if (this.categories && this.categories.length > 0) {
      console.log('Using input categories');
      this.useInputCategories();
    } else {
      console.log('Loading categories from service');
      this.loadCategoriesWithCounts();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Select category and emit event
   */
  selectCategory(categoryId: number | null): void {
    console.log('Category selected:', categoryId);
    this.selectedCategoryId = categoryId;
    this.categorySelected.emit(categoryId);
  }

  /**
   * Handle category click with navigation
   */
  onCategorySelect(categoryId: number): void {
    console.log('Category clicked:', categoryId, 'Navigation mode:', this.navigationMode);
    
    this.selectedCategoryId = categoryId;
    this.categorySelected.emit(categoryId);
    
    if (this.navigationMode === 'route') {
      this.router.navigate(['/shop'], {
        queryParams: { 
          categoryId, 
          page: 1 
        }
      });
    } else if (this.navigationMode === 'query') {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { categoryId, page: 1 },
        queryParamsHandling: 'merge'
      });
    }
  }

  /**
   * Load categories with product counts from service
   */
  loadCategoriesWithCounts(): void {
    this.isLoading = true;
    this.error = null;
    
    console.log('Loading categories and counts...');
    
    forkJoin({
      categories: this.categoryService.getAllCategories(),
      counts: this.categoryService.getCategoryProductCounts()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ categories, counts }) => {
        console.log('Categories loaded:', categories);
        console.log('Counts loaded:', counts);
        
        const countMap = new Map<number, number>();
        counts.forEach(c => countMap.set(c.category_id, c.count));

        const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
          ? categories.filter(c => this.onlyCategoryIds!.includes(c.id))
          : categories;

        this.localCategories = filtered.map(cat => ({
          ...cat,
          productCount: countMap.get(cat.id) || 0
        }));
        
        this.filteredCategories = [...this.localCategories];
        console.log('Final categories with counts:', this.localCategories);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.error = 'Failed to load categories';
        this.isLoading = false;
        this.localCategories = [];
        this.filteredCategories = [];
      }
    });
  }

  /**
   * Use input categories and load counts for them
   */
  useInputCategories(): void {
    this.isLoading = true;
    this.error = null;
    
    console.log('Using input categories and loading counts...');
    
    this.categoryService.getCategoryProductCounts().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (counts) => {
        console.log('Counts loaded for input categories:', counts);
        
        const countMap = new Map<number, number>();
        counts.forEach(c => countMap.set(c.category_id, c.count));

        const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
          ? this.categories.filter(c => this.onlyCategoryIds!.includes(c.id))
          : this.categories;

        this.localCategories = filtered.map(cat => ({
          ...cat,
          productCount: countMap.get(cat.id) || 0
        }));
        
        this.filteredCategories = [...this.localCategories];
        console.log('Final input categories with counts:', this.localCategories);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading counts for input categories:', error);
        
        const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
          ? this.categories.filter(c => this.onlyCategoryIds!.includes(c.id))
          : this.categories;

        this.localCategories = filtered.map(cat => ({
          ...cat,
          productCount: 0
        }));
        
        this.filteredCategories = [...this.localCategories];
        this.isLoading = false;
      }
    });
  }

  /**
   * Search functionality
   */
  onSearchChange(event?: Event): void {
    // Prevent event bubbling to avoid closing dropdown
    if (event) {
      event.stopPropagation();
    }
    
    if (!this.searchTerm.trim()) {
      this.filteredCategories = [...this.localCategories];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredCategories = this.localCategories.filter(category =>
        category.name.toLowerCase().includes(term)
      );
    }
  }

  /**
   * Clear search
   */
  clearSearch(event?: Event): void {
    // Prevent event bubbling to avoid closing dropdown
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.searchTerm = '';
    this.filteredCategories = [...this.localCategories];
  }

  /**
   * Toggle show all categories
   */
  toggleShowAll(event?: Event): void {
    // Prevent event bubbling to avoid closing dropdown
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.showAll = !this.showAll;
  }

  /**
   * Get filtered categories (for search results)
   */
  getFilteredCategories(): CategoryWithCount[] {
    return this.filteredCategories;
  }

  /**
   * Get visible categories based on search and show all state
   */
  getVisibleCategories(): CategoryWithCount[] {
    if (!this.searchTerm) {
      // Show all if mobile auto-expand is enabled or showAll is true
      const shouldShowAll = this.showAll || (this.autoExpandOnMobile && this.isMobileDevice);
      return shouldShowAll ? this.localCategories : this.localCategories.slice(0, this.initialVisibleCount);
    }
    return this.filteredCategories;
  }

  /**
   * Generate category slug from name
   */
  getCategorySlug(categoryName: string): string {
    return categoryName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  /**
   * Get display categories (for backward compatibility)
   */
  get displayCategories(): CategoryWithCount[] {
    return this.localCategories;
  }

  /**
   * Get total product count across all categories
   */
  getTotalProductCount(): number {
    return this.localCategories.reduce((total, category) => total + (category.productCount || 0), 0);
  }

  /**
   * Retry loading categories
   */
  retry(): void {
    if (this.categories && this.categories.length > 0) {
      this.useInputCategories();
    } else {
      this.loadCategoriesWithCounts();
    }
  }

  /**
   * Check if show toggle button should be displayed
   */
  shouldShowToggleButton(): boolean {
    // Don't show if disabled via input
    if (!this.showToggleButton) {
      return false;
    }
    
    // Don't show on mobile if auto-expand is enabled
    if (this.autoExpandOnMobile && this.isMobileDevice) {
      return false;
    }
    
    // Show if there are more categories than initial visible count and no search
    return this.displayCategories.length > this.initialVisibleCount && !this.searchTerm;
  }

  /**
   * Detect if device is mobile
   */
  private detectMobileDevice(): void {
    // Check screen width
    const screenWidth = window.innerWidth;
    
    // Check user agent for mobile devices
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'tablet'];
    const isMobileUserAgent = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Consider mobile if screen width is small OR user agent indicates mobile
    this.isMobileDevice = screenWidth <= 768 || isMobileUserAgent;
    
    console.log('Mobile device detected:', this.isMobileDevice, 'Screen width:', screenWidth);
  }

  /**
   * Handle image load error
   */
  onImageError(event: any): void {
    if (event.target) {
      event.target.src = this.fallbackImg;
    }
  }

  /**
   * TrackBy function for better performance
   */
  trackByFn(index: number, item: CategoryWithCount): number {
    return item.id;
  }
}