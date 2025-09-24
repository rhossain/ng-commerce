import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';
import { SearchRequest, SearchResponse, SortOption, SORT_OPTIONS } from '../models/search.model';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl: string;

  // Search state management
  private searchResultsSubject = new BehaviorSubject<SearchResponse | null>(null);
  searchResults$ = this.searchResultsSubject.asObservable();

  private searchLoadingSubject = new BehaviorSubject<boolean>(false);
  searchLoading$ = this.searchLoadingSubject.asObservable();

  private currentFiltersSubject = new BehaviorSubject<SearchRequest>({});
  currentFilters$ = this.currentFiltersSubject.asObservable();

  // Simple search history in memory
  private searchHistorySubject = new BehaviorSubject<string[]>([]);
  searchHistory$ = this.searchHistorySubject.asObservable();

  private readonly HISTORY_CACHE_KEY = 'search-history';

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {
    this.apiUrl = environment.apiBaseUrl;
    this.loadSearchHistory();
  }

  /**
   * Main search method - uses the single products/search endpoint
   */
  searchProducts(searchRequest: SearchRequest): Observable<SearchResponse> {
    this.searchLoadingSubject.next(true);
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.searchProducts}`;
    let params = new HttpParams();

    // Build query parameters
    if (searchRequest.q?.trim()) {
      params = params.set('q', searchRequest.q.trim());
    }
    if (searchRequest.category_id !== null && searchRequest.category_id !== undefined) {
      params = params.set('category_id', searchRequest.category_id.toString());
    }
    if (searchRequest.min_price !== null && searchRequest.min_price !== undefined) {
      params = params.set('min_price', searchRequest.min_price.toString());
    }
    if (searchRequest.max_price !== null && searchRequest.max_price !== undefined) {
      params = params.set('max_price', searchRequest.max_price.toString());
    }
    if (searchRequest.sort_by) {
      params = params.set('sort_by', searchRequest.sort_by);
    }
    if (searchRequest.sort_order) {
      params = params.set('sort_order', searchRequest.sort_order);
    }
    
    params = params.set('page', (searchRequest.page || 1).toString());
    params = params.set('per_page', (searchRequest.per_page || 12).toString());

    // console.log('🔍 Search request:', { url, params: params.toString() });

    return this.http.get<any>(url, { params }).pipe(
      map(response => this.transformXanoResponse(response)),
      tap(response => {
        // console.log('✅ Search results:', response);
        
        this.searchResultsSubject.next(response);
        this.currentFiltersSubject.next(searchRequest);
        
        // Save to search history
        if (searchRequest.q?.trim()) {
          this.addToSearchHistory(searchRequest.q.trim());
        }
        
        // Show results count
        const count = response.pagination?.total_items || 0;
        if (count === 0) {
          this.toastr.info('No products found matching your search', 'Search Results');
        } else {
          this.toastr.success(`Found ${count} product${count !== 1 ? 's' : ''}`, 'Search Results');
        }
        
        this.searchLoadingSubject.next(false);
      }),
      catchError(error => {
        console.error('❌ Search error:', error);
        this.searchLoadingSubject.next(false);
        
        if (error.status === 400) {
          this.toastr.error('Invalid search parameters', 'Search Error');
        } else if (error.status === 0) {
          this.toastr.error('Network error - check your connection', 'Search Error');
        } else {
          this.toastr.error('Search failed. Please try again.', 'Search Error');
        }
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Get available sort options
   */
  getSortOptions(): SortOption[] {
    return SORT_OPTIONS;
  }

  /**
   * Parse sort option value to sort_by and sort_order
   */
  parseSortOption(sortValue: string): { sort_by: string; sort_order: 'asc' | 'desc' } {
    const option = SORT_OPTIONS.find(opt => opt.value === sortValue);
    if (option) {
      return { sort_by: option.field, sort_order: option.order };
    }
    return { sort_by: 'name', sort_order: 'asc' };
  }

  /**
   * Build search URL for navigation
   */
  buildSearchUrl(filters: SearchRequest): string {
    const params = new URLSearchParams();
    
    if (filters.q) params.set('q', filters.q);
    if (filters.category_id !== null && filters.category_id !== undefined) {
      params.set('category_id', filters.category_id.toString());
    }
    if (filters.min_price !== null && filters.min_price !== undefined) {
      params.set('min_price', filters.min_price.toString());
    }
    if (filters.max_price !== null && filters.max_price !== undefined) {
      params.set('max_price', filters.max_price.toString());
    }
    if (filters.sort_by) params.set('sort_by', filters.sort_by);
    if (filters.sort_order) params.set('sort_order', filters.sort_order);
    if (filters.page && filters.page > 1) params.set('page', filters.page.toString());
    if (filters.per_page && filters.per_page !== 12) params.set('per_page', filters.per_page.toString());

    return `/shop?${params.toString()}`; // ✅ Changed from /search-results to /shop
  }

  /**
   * Parse URL parameters to SearchRequest
   */
  parseUrlToSearchRequest(urlParams: URLSearchParams): SearchRequest {
    return {
      q: urlParams.get('q') || undefined,
      category_id: urlParams.get('category_id') ? parseInt(urlParams.get('category_id')!) : null,
      min_price: urlParams.get('min_price') ? parseFloat(urlParams.get('min_price')!) : null,
      max_price: urlParams.get('max_price') ? parseFloat(urlParams.get('max_price')!) : null,
      sort_by: (urlParams.get('sort_by') as any) || undefined,
      sort_order: (urlParams.get('sort_order') as any) || undefined,
      page: urlParams.get('page') ? parseInt(urlParams.get('page')!) : undefined,
      per_page: urlParams.get('per_page') ? parseInt(urlParams.get('per_page')!) : undefined
    };
  }

  /**
   * Clear search results and filters
   */
  clearSearch(): void {
    this.searchResultsSubject.next(null);
    this.currentFiltersSubject.next({});
    this.searchLoadingSubject.next(false);
  }

  /**
   * Get current search results
   */
  getCurrentSearchResults(): SearchResponse | null {
    return this.searchResultsSubject.value;
  }

  /**
   * Get current filters
   */
  getCurrentFilters(): SearchRequest {
    return this.currentFiltersSubject.value;
  }

  /**
   * Update search filters without searching
   */
  updateFilters(filters: Partial<SearchRequest>): void {
    const currentFilters = this.currentFiltersSubject.value;
    this.currentFiltersSubject.next({ ...currentFilters, ...filters });
  }

  // Search history management (simplified, local only)
  private loadSearchHistory(): void {
    const history = localStorage.getItem(this.HISTORY_CACHE_KEY);
    if (history) {
      try {
        this.searchHistorySubject.next(JSON.parse(history));
      } catch {
        this.searchHistorySubject.next([]);
      }
    }
  }

  private addToSearchHistory(query: string): void {
    const currentHistory = this.searchHistorySubject.value;
    const updatedHistory = [query, ...currentHistory.filter(h => h !== query)].slice(0, 5);
    
    this.searchHistorySubject.next(updatedHistory);
    localStorage.setItem(this.HISTORY_CACHE_KEY, JSON.stringify(updatedHistory));
  }

  /**
   * Get search suggestions using the same search endpoint
   */
  getSearchSuggestions(query: string): Observable<string[]> {
    if (!query.trim() || query.length < 2) {
      return new BehaviorSubject<string[]>([]).asObservable();
    }

    const url = `${this.apiUrl}/${environment.apiEndpoints.product.searchProducts}`;
    const params = new HttpParams()
      .set('q', query.trim())
      .set('per_page', '5') // Get only 5 products for suggestions
      .set('page', '1');

    return this.http.get<any>(url, { params }).pipe(
      map(response => {
        // Extract unique product names as suggestions
        const suggestions = (response.items || [])
          .map((product: any) => product.name)
          .filter((name: string, index: number, array: string[]) => array.indexOf(name) === index) // Remove duplicates
          .slice(0, 5); // Limit to 5 suggestions
        
        return suggestions;
      }),
      catchError(error => {
        console.warn('Failed to get search suggestions:', error);
        return new BehaviorSubject<string[]>([]).asObservable();
      })
    );
  }

  /**
   * Transform Xano response to expected SearchResponse format
   */
  private transformXanoResponse(response: any): SearchResponse {
    // Check if response already has the expected format
    if (response.pagination) {
      return response as SearchResponse;
    }

    // Transform Xano pagination format to expected format
    const transformedResponse: SearchResponse = {
      items: response.items || [],
      pagination: {
        current_page: response.curPage || 1,
        per_page: response.perPage || 12,
        total_items: response.itemsTotal || 0,
        total_pages: response.pageTotal || 0,
        has_next: response.nextPage !== null,
        has_prev: response.prevPage !== null,
        next_page: response.nextPage,
        prev_page: response.prevPage
      },
      filters: response.filters || {
        search_query: '',
        category_id: null,
        min_price: null,
        max_price: null,
        sort_by: 'name',
        sort_order: 'asc'
      }
    };

    return transformedResponse;
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistorySubject.next([]);
    localStorage.removeItem(this.HISTORY_CACHE_KEY);
    this.toastr.info('Search history cleared', 'History');
  }
}