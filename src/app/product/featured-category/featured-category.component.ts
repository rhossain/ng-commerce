import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { CategoryService } from '../../services/category.service';
import { ProductCategory } from '../../models/category.model';

interface CategoryWithCount extends ProductCategory {
  productCount: number;
}

@Component({
  selector: 'app-featured-category',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './featured-category.component.html',
  styleUrls: ['./featured-category.component.scss']
})
export class FeaturedCategoryComponent implements OnInit, OnDestroy {
  @Input() styleType: 'default' | 'list' | 'grid' | 'pill' | 'sidebar' = 'default';
  @Input() selectedCategoryId: number | null = null;
  @Input() onlyCategoryIds?: number[];
  @Input() categories: ProductCategory[] = [];
  @Input() navigationMode: 'query' | 'route' | 'custom' = 'custom'; // Added 'custom' option

  @Output() categorySelected = new EventEmitter<number | null>();

  // Local categories with counts (will override input categories when loaded)
  localCategories: CategoryWithCount[] = [];
  isLoading = true;
  error: string | null = null;
  fallbackImg = 'assets/images/image-not-loaded.jpg';
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    console.log('FeaturedCategoryComponent ngOnInit called');
    console.log('Input categories:', this.categories);
    
    // If categories are passed as input, use them, otherwise load from service
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

  selectCategory(categoryId: number | null): void {
    console.log('Category selected:', categoryId);
    this.categorySelected.emit(categoryId);
  }

  onCategorySelect(categoryId: number): void {
    console.log('Category clicked:', categoryId, 'Navigation mode:', this.navigationMode);
    
    // Always emit the event for parent components to handle
    this.categorySelected.emit(categoryId);
    
    // Handle navigation based on mode
    if (this.navigationMode === 'route') {
      // Navigate to shop page with category
      this.router.navigate(['/shop'], {
        queryParams: { 
          categoryId, 
          page: 1 
        }
      });
    } else if (this.navigationMode === 'query') {
      // Update query params on current route
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { categoryId, page: 1 },
        queryParamsHandling: 'merge'
      });
    }
    // If navigationMode is 'custom' or not set, let parent handle via event only
  }  

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
        
        // Create a map for faster lookup
        const countMap = new Map<number, number>();
        counts.forEach(c => countMap.set(c.category_id, c.count));

        // Filter categories if onlyCategoryIds is provided
        const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
          ? categories.filter(c => this.onlyCategoryIds!.includes(c.id))
          : categories;

        // Add product counts to categories
        this.localCategories = filtered.map(cat => ({
          ...cat,
          productCount: countMap.get(cat.id) || 0
        }));
        
        console.log('Final categories with counts:', this.localCategories);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.error = 'Failed to load categories';
        this.isLoading = false;
        
        // Fallback to empty array
        this.localCategories = [];
      }
    });
  }

  // Use input categories and load counts for them
  useInputCategories(): void {
    this.isLoading = true;
    this.error = null;
    
    console.log('Using input categories and loading counts...');
    
    this.categoryService.getCategoryProductCounts().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (counts) => {
        console.log('Counts loaded for input categories:', counts);
        
        // Create a map for faster lookup
        const countMap = new Map<number, number>();
        counts.forEach(c => countMap.set(c.category_id, c.count));

        // Filter categories if onlyCategoryIds is provided
        const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
          ? this.categories.filter(c => this.onlyCategoryIds!.includes(c.id))
          : this.categories;

        // Add product counts to input categories
        this.localCategories = filtered.map(cat => ({
          ...cat,
          productCount: countMap.get(cat.id) || 0
        }));
        
        console.log('Final input categories with counts:', this.localCategories);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading counts for input categories:', error);
        
        // Fallback to using input categories without counts
        const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
          ? this.categories.filter(c => this.onlyCategoryIds!.includes(c.id))
          : this.categories;

        this.localCategories = filtered.map(cat => ({
          ...cat,
          productCount: 0
        }));
        
        this.isLoading = false;
      }
    });
  }

  getCategorySlug(categoryName: string): string {
    return categoryName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .trim();
  }

  // Get the categories to display
  get displayCategories(): CategoryWithCount[] {
    return this.localCategories;
  }

  // Helper method to retry loading
  retry(): void {
    this.loadCategoriesWithCounts();
  }

  // TrackBy function for better performance
  trackByFn(index: number, item: CategoryWithCount): number {
    return item.id;
  }
}