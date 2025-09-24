import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SearchService } from '../../services/search.service';
import { CategoryService } from '../../services/category.service';
import { SearchRequest, SearchResponse, SORT_OPTIONS, PRICE_RANGES, PER_PAGE_OPTIONS } from '../../models/search.model';
import { ProductCategory } from '../../models/category.model';
import ListComponent from '../../product/list/list.component';

@Component({
  selector: 'app-search-result',
  standalone: true,
  imports: [CommonModule, FormsModule, ListComponent],
  templateUrl: './search-result.component.html',
  styleUrl: './search-result.component.scss'
})
export default class SearchResultComponent implements OnInit, OnDestroy {
  // Search state
  searchResults: SearchResponse | null = null;
  currentFilters: SearchRequest = {};
  isLoading = false;
  
  // Filter options
  categories: ProductCategory[] = [];
  sortOptions = SORT_OPTIONS;
  priceRanges = PRICE_RANGES;
  perPageOptions = PER_PAGE_OPTIONS;
  
  // Filter form values for the list component
  selectedCategory: number | null = null;
  customMinPrice: number | null = null;
  customMaxPrice: number | null = null;
  searchQuery: string = '';
  
  // UI states
  showFilters = true;
  viewMode: 'grid' | 'list' = 'grid';
  totalProducts = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
    private categoryService: CategoryService
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.setupRouteSubscription();
    this.setupSearchSubscription();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupRouteSubscription(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        // Extract search parameters from URL
        this.searchQuery = params['q'] || '';
        this.selectedCategory = params['category_id'] ? parseInt(params['category_id']) : null;
        this.customMinPrice = params['min_price'] ? parseFloat(params['min_price']) : null;
        this.customMaxPrice = params['max_price'] ? parseFloat(params['max_price']) : null;
        
        // Build search request
        const searchRequest: SearchRequest = {
          q: this.searchQuery || undefined,
          category_id: this.selectedCategory,
          min_price: this.customMinPrice,
          max_price: this.customMaxPrice,
          sort_by: params['sort_by'] || 'name',
          sort_order: params['sort_order'] || 'asc',
          page: params['page'] ? parseInt(params['page']) : 1,
          per_page: params['per_page'] ? parseInt(params['per_page']) : 12
        };
        
        this.currentFilters = searchRequest;
        this.performSearch(searchRequest);
      });
  }

  private setupSearchSubscription(): void {
    this.searchService.searchResults$
      .pipe(takeUntil(this.destroy$))
      .subscribe(results => {
        this.searchResults = results;
      });

    this.searchService.searchLoading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });
  }

  private loadCategories(): void {
    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => console.error('Failed to load categories:', error)
      });
  }

  private performSearch(filters: SearchRequest): void {
    this.searchService.searchProducts(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          // Results are handled by the service subscription
        },
        error: (error) => {
          console.error('Search failed:', error);
        }
      });
  }

  // Filter change handlers
  onCategorySelect(categoryId: number | null): void {
    this.updateFilters({
      category_id: categoryId,
      page: 1
    });
  }

  onPriceChange(): void {
    this.updateFilters({
      min_price: this.customMinPrice,
      max_price: this.customMaxPrice,
      page: 1
    });
  }

  clearFilters(): void {
    this.selectedCategory = null;
    this.customMinPrice = null;
    this.customMaxPrice = null;
    
    // Keep only the search query
    const newFilters: SearchRequest = {
      q: this.searchQuery || undefined,
      page: 1,
      per_page: 12
    };

    this.updateUrlAndSearch(newFilters);
  }

  // View mode toggle
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  // Utility methods
  private updateFilters(updates: Partial<SearchRequest>): void {
    const newFilters: SearchRequest = { 
      ...this.currentFilters, 
      ...updates 
    };
    this.updateUrlAndSearch(newFilters);
  }

  private updateUrlAndSearch(filters: SearchRequest): void {
    const url = this.searchService.buildSearchUrl(filters);
    this.router.navigateByUrl(url);
  }

  // Product count handler for list component
  productCountChanged(count: number): void {
    this.totalProducts = count;
  }

  // Template helpers
  getCategoryName(categoryId: number): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown Category';
  }

  // Safe getters for template
  getTotalItems(): number {
    return this.searchResults?.pagination?.total_items || 0;
  }

  getItemsLength(): number {
    return this.searchResults?.items?.length || 0;
  }

  hasResults(): boolean {
    return this.getItemsLength() > 0;
  }

  getResultsRange(): { start: number; end: number } {
    if (!this.searchResults?.pagination) return { start: 0, end: 0 };
    
    const { current_page, per_page, total_items } = this.searchResults.pagination;
    const start = (current_page - 1) * per_page + 1;
    const end = Math.min(current_page * per_page, total_items);
    
    return { start, end };
  }

  trackByIndex(index: number): number {
    return index;
  }
}