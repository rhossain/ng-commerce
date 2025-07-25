import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrModule } from 'ngx-toastr';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { SearchService } from '../../services/search.service';
import { FeaturedCategoryComponent } from "../featured-category/featured-category.component";
import ListComponent from "../list/list.component";
import { SearchRequest } from '../../models/search.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [FormsModule, CommonModule, ToastrModule, FeaturedCategoryComponent, ListComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export default class ShopComponent implements OnInit, OnChanges {
  price: number = 100;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  totalProducts: number = 0;
  categoryId: number | null = null;
  selectedCategoryId: number | null = null;
  currentPage = 1;
  sortBy: string = 'id';
  orderBy: 'asc' | 'desc' = 'asc';
  filterType: 'featured' | 'new' | 'best-sell' | 'discounted' | null = null;
  categories: ProductCategory[] = [];

  // Search-specific properties
  searchQuery: string = '';
  isSearchMode: boolean = false;
  searchResults: any = null;

  constructor (
    private route: ActivatedRoute, 
    private router: Router, 
    private categoryService: CategoryService,
    private searchService: SearchService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Implementation if needed
  }
  
  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // Check if this is a search request
      this.searchQuery = params['q'] || '';
      this.isSearchMode = !!this.searchQuery;

      // Extract all parameters (works for both shop and search)
      this.selectedCategoryId = params['categoryId'] || params['category_id'] ? +(params['categoryId'] || params['category_id']) : null;
      
      // Handle both parameter formats for price
      this.minPrice = params['minPrice'] || params['min_price'] ? +(params['minPrice'] || params['min_price']) : null;
      this.maxPrice = params['maxPrice'] || params['max_price'] ? +(params['maxPrice'] || params['max_price']) : null;
      
      this.filterType = params['filter'] ?? null;
      this.currentPage = +params['page'] || 1;
      this.sortBy = params['sortBy'] || params['sort_by'] || 'id';
      this.orderBy = (params['orderBy'] || params['sort_order']) === 'desc' ? 'desc' : 'asc';

      // If search mode, perform search
      if (this.isSearchMode) {
        this.performSearch();
      }
    });

    this.loadCategories();

    // Subscribe to search results
    this.searchService.searchResults$.subscribe(results => {
      if (this.isSearchMode) {
        this.searchResults = results;
      }
    });
  }

  // Perform search using SearchService
  private performSearch(): void {
    const searchRequest: SearchRequest = {
      q: this.searchQuery,
      category_id: this.selectedCategoryId,
      min_price: this.minPrice,
      max_price: this.maxPrice,
      sort_by: this.sortBy as any, // ✅ Type assertion to handle string types
      sort_order: this.orderBy,
      page: this.currentPage,
      per_page: 12
    };

    this.searchService.searchProducts(searchRequest).subscribe({
      next: (results) => {
        // Results handled by subscription above
      },
      error: (error) => {
        console.error('Search failed:', error);
      }
    });
  }

  // Handle both shop and search URL updates
  private updateUrl(params: { [key: string]: any }): void {
    // Determine the correct parameter names based on mode
    const urlParams: { [key: string]: any } = {};
    
    if (this.isSearchMode) {
      // Search mode - use search parameter names
      if (params['categoryId'] !== undefined) urlParams['category_id'] = params['categoryId'];
      if (params['minPrice'] !== undefined) urlParams['min_price'] = params['minPrice'];
      if (params['maxPrice'] !== undefined) urlParams['max_price'] = params['maxPrice'];
      if (params['sortBy'] !== undefined) urlParams['sort_by'] = params['sortBy'];
      if (params['orderBy'] !== undefined) urlParams['sort_order'] = params['orderBy'];
      if (this.searchQuery) urlParams['q'] = this.searchQuery;
    } else {
      // Shop mode - use shop parameter names
      Object.assign(urlParams, params);
    }

    // Add other common parameters
    if (params['page'] !== undefined) urlParams['page'] = params['page'];
    if (params['filter'] !== undefined) urlParams['filter'] = params['filter'];

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: urlParams,
      queryParamsHandling: 'merge'
    });
  }

  // Modified existing methods to work with both modes
  onPriceChange(): void {
    this.updateUrl({
      'minPrice': this.minPrice,
      'maxPrice': this.maxPrice,
      'page': 1
    });
  }

  // Clear individual price filters
  clearMinPrice(): void {
    this.minPrice = null;
    this.onPriceChange();
  }

  clearMaxPrice(): void {
    this.maxPrice = null;
    this.onPriceChange();
  }

  // Clear entire price range
  clearPriceRange(): void {
    this.minPrice = null;
    this.maxPrice = null;
    this.onPriceChange();
  }

  // Set quick price ranges
  setQuickPrice(min: number | null, max: number | null): void {
    this.minPrice = min;
    this.maxPrice = max;
    this.onPriceChange();
  }

  productCountChanged(count: number) {
    this.totalProducts = count;
  }

  onSearchSubmit() {
    if (this.searchQuery.trim()) {
      // Navigate to search mode
      this.router.navigate(['/shop'], {
        queryParams: { 
          q: this.searchQuery.trim(),
          page: 1 
        }
      });
    }
  }

  filterByCategory(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.updateUrl({ 
      'categoryId': categoryId,
      'page': 1 
    });
  }

  onSortChange(sortBy: string, orderBy: 'asc' | 'desc') {
    this.sortBy = sortBy;
    this.orderBy = orderBy;
    this.updateUrl({ 
      'sortBy': sortBy, 
      'orderBy': orderBy,
      'page': 1 
    });
  }
  
  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateUrl({ 'page': page });
  }

  loadCategories(): void {
    this.categoryService.getAllCategories().subscribe((res) => {
      this.categories = res;
    });
  }

  onCategorySelect(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.updateUrl({
      'categoryId': categoryId,
      'page': 1
    });
  }

  applyFilter(filter: string) {
    // Clear all other filters when applying Featured/New filter
    this.searchQuery = '';
    this.selectedCategoryId = null;
    this.minPrice = null;
    this.maxPrice = null;
    this.isSearchMode = false;
    this.searchResults = null;
    
    // Navigate with only the filter parameter
    this.router.navigate(['/shop'], {
      queryParams: { 
        filter: filter, 
        page: 1 
      }
    });
  }

  // Clear search and return to shop mode
  clearSearch(): void {
    this.searchQuery = '';
    this.isSearchMode = false;
    this.searchResults = null;
    this.selectedCategoryId = null;
    this.minPrice = null;
    this.maxPrice = null;
    this.filterType = null;
    
    // Navigate to clean shop URL
    this.router.navigate(['/shop'], {
      queryParams: {
        page: 1
      }
    });
  }

  // Clear all filters (including Featured/New)
  clearAllFilters(): void {
    this.searchQuery = '';
    this.isSearchMode = false;
    this.searchResults = null;
    this.selectedCategoryId = null;
    this.minPrice = null;
    this.maxPrice = null;
    this.filterType = null;
    
    // Navigate to clean shop URL with no filters
    this.router.navigate(['/shop'], {
      queryParams: {
        page: 1
      }
    });
  }

  // Get page title based on mode
  getPageTitle(): string {
    if (this.isSearchMode && this.searchQuery) {
      return `Search results for "${this.searchQuery}"`;
    } else if (this.filterType === 'featured') {
      return 'Featured Products';
    } else if (this.filterType === 'new') {
      return 'New Products';
    } else if (this.selectedCategoryId) {
      const category = this.categories.find(c => c.id === this.selectedCategoryId);
      return `${category?.name || 'Category'}`;
    } else {
      return 'All Products';
    }
  }

  // Get results count message
  getResultsMessage(): string {
    if (this.isSearchMode && this.searchResults) {
      const total = this.searchResults.pagination?.total_items || 0;
      return `${total} products found`;
    } else {
      return `${this.totalProducts} products found`;
    }
  }

  // Get active filters text for display
  getActiveFiltersText(): string {
    const filters: string[] = [];
    
    if (this.minPrice && this.maxPrice) {
      filters.push(`${this.minPrice} - ${this.maxPrice}`);
    } else if (this.minPrice) {
      filters.push(`From ${this.minPrice}`);
    } else if (this.maxPrice) {
      filters.push(`Up to ${this.maxPrice}`);
    }
    
    if (this.selectedCategoryId && !this.isSearchMode) {
      const category = this.categories.find(c => c.id === this.selectedCategoryId);
      if (category) {
        filters.push(category.name);
      }
    }
    
    return filters.length > 0 ? `Filters: ${filters.join(', ')}` : '';
  }

  // Debug method to check price filter
  debugPriceFilter(): void {
    console.log('🔍 Debug Price Filter:');
    console.log('- minPrice:', this.minPrice);
    console.log('- maxPrice:', this.maxPrice);
    console.log('- isSearchMode:', this.isSearchMode);
    console.log('- selectedCategoryId:', this.selectedCategoryId);
    console.log('- filterType:', this.filterType);
    console.log('- searchResults:', this.searchResults);
    
    // Check what's being passed to list component
    console.log('📦 List Component Props:');
    console.log('- [minPrice]:', this.minPrice ?? undefined);
    console.log('- [maxPrice]:', this.maxPrice ?? undefined);
    console.log('- [categoryId]:', this.selectedCategoryId);
    console.log('- [filterType]:', this.filterType);
    console.log('- [externalProducts]:', this.isSearchMode ? this.searchResults?.items : undefined);
    console.log('- [externalPagination]:', this.isSearchMode ? this.searchResults?.pagination : undefined);
  }
}