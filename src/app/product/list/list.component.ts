import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUp, faArrowDown, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { CardComponent } from '../card/card.component';
import { ProductService } from '../../services/product.service';
import { ProductCacheService } from '../../services/product-cache.service';
import { CartService } from '../../services/cart.service';
import { ProductModel } from '../../models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, FontAwesomeModule, CardComponent],
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss'
})
export default class ListComponent implements OnInit, OnChanges, OnDestroy {
  products: ProductModel[] = [];
  filteredProducts: ProductModel[] = [];
  loading = false;
  skeletonCount = Array(3);
  destroy$ = new Subject<void>();

  // ✅ NEW: Track total items count
  totalItemsCount = 0;

  // ✅ NEW: Accept external data from search results
  @Input() externalProducts?: ProductModel[];
  @Input() externalPagination?: any;
  @Input() searchQuery?: string;

  // Existing inputs
  @Input() minPrice?: number;
  @Input() maxPrice?: number = 100;
  @Input() categoryId?: number | null;
  @Input() filterType: 'featured' | 'new' | 'best-sell' | 'discounted' | null = null;
  @Output() productCountChanged = new EventEmitter<number>();

  currentPage = 1;
  totalPages = 1;
  pageNumbers: (number | string)[] = [];
  perPage = 6;

  sortBy = 'id';
  orderBy: 'asc' | 'desc' = 'asc';
  sortOptions = [
    { label: 'ID', value: 'id' },
    { label: 'Name', value: 'name' },
    { label: 'Price', value: 'price' },
    { label: 'Created At', value: 'created_at' },
  ];

  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  faRotateLeft = faRotateLeft;

  Math = Math;

  private filtersChanged$ = new Subject<void>();

  constructor(
    private productCacheService: ProductCacheService,
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService
  ) {}

  ngOnInit(): void {
    // ✅ Check if we have external data (from search)
    if (this.externalProducts && this.externalPagination) {
      this.useExternalData();
      return;
    }

    // Original logic for non-search pages
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(async (params) => {
      this.filterType = params['filter'] || null;
      this.currentPage = +params['page'] || 1;
      this.perPage = +params['perPage'] || 6;
      this.sortBy = params['sortBy'] || 'id';
      this.orderBy = params['orderBy'] === 'desc' ? 'desc' : 'asc';
      this.categoryId = params['categoryId'] ? +params['categoryId'] : null;

      if (!params['page'] || this.currentPage < 1 || isNaN(this.currentPage)) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: 1 },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      } else {
        await this.fetchProducts();
      }
    });

    this.filtersChanged$.pipe(debounceTime(200), takeUntil(this.destroy$)).subscribe(() => {
      this.currentPage = 1;
      this.updateQueryParams({
        page: 1,
        perPage: this.perPage,
        sortBy: this.sortBy,
        orderBy: this.orderBy,
        categoryId: this.categoryId,
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // ✅ Handle external data changes
    if (changes['externalProducts'] && this.externalProducts) {
      this.useExternalData();
      return;
    }

    // Original logic
    if (changes['minPrice'] || changes['maxPrice'] || changes['categoryId']) {
      this.filtersChanged$.next();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ NEW: Use external data from search results
  private useExternalData(): void {
    if (!this.externalProducts || !this.externalPagination) return;

    this.products = this.externalProducts;
    this.filteredProducts = this.externalProducts;
    this.currentPage = this.externalPagination.current_page || 1;
    this.totalPages = this.externalPagination.total_pages || 1;
    this.perPage = this.externalPagination.per_page || 12;
    
    // ✅ Set total items count from external pagination
    this.totalItemsCount = this.externalPagination.total_items || this.externalPagination.itemsTotal || this.externalProducts.length;
    
    this.productCountChanged.emit(this.totalItemsCount);
    this.generatePageNumbers();
  }

  async fetchProducts(): Promise<void> {
    // ✅ Skip fetching if using external data
    if (this.externalProducts) {
      this.useExternalData();
      return;
    }

    this.loading = true;
    try {
      const res = await this.productCacheService.getPaginatedProducts(
        this.currentPage,
        this.perPage,
        this.sortBy,
        this.orderBy,
        this.categoryId ?? undefined,
        this.minPrice ?? undefined,
        this.maxPrice ?? undefined,
        this.filterType ?? undefined
      );
      this.products = res.items;
      this.filteredProducts = res.items;
      this.currentPage = res.curPage;
      this.totalPages = res.pageTotal;
      
      // ✅ Set total items count from response
      this.totalItemsCount = res.itemsTotal;
      
      this.productCountChanged.emit(this.totalItemsCount);
      this.generatePageNumbers();
    } catch (err) {
      console.error('Failed to fetch products:', err);
      this.toastrService.error('Error loading products.', 'Error');
    } finally {
      this.loading = false;
    }
  }

  generatePageNumbers(): void {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 2;
    const range = new Set<number>();
    const result: (number | string)[] = [];

    range.add(1);
    for (let i = current - delta; i <= current + delta; i++) {
      if (i > 1 && i < total) range.add(i);
    }
    if (total > 1) range.add(total);

    const sorted = Array.from(range).sort((a, b) => a - b);
    let prev: number | undefined;

    for (const page of sorted) {
      if (prev !== undefined && page - prev > 1) {
        result.push('...');
      }
      result.push(page);
      prev = page;
    }

    this.pageNumbers = result;
  }

  goToPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      // ✅ For search results, handle pagination differently
      if (this.externalProducts) {
        this.handleSearchPagination(page);
      } else {
        this.updateQueryParams({ page });
      }
    }
  }

  // ✅ NEW: Handle pagination for search results
  private handleSearchPagination(page: number): void {
    // Update URL with search parameters
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('page', page.toString());
    this.router.navigateByUrl(currentUrl.pathname + currentUrl.search);
  }

  onSortChange(): void {
    if (this.externalProducts) {
      this.handleSearchSorting(this.sortBy, this.orderBy);
    } else {
      this.navigateWithSort(this.sortBy, this.orderBy);
    }
  }

  toggleOrder(): void {
    this.orderBy = this.orderBy === 'asc' ? 'desc' : 'asc';
    if (this.externalProducts) {
      this.handleSearchSorting(this.sortBy, this.orderBy);
    } else {
      this.navigateWithSort(this.sortBy, this.orderBy);
    }
  }

  resetSort(): void {
    this.sortBy = 'id';
    this.orderBy = 'asc';
    if (this.externalProducts) {
      this.handleSearchSorting(this.sortBy, this.orderBy);
    } else {
      this.navigateWithSort(this.sortBy, this.orderBy);
    }
  }

  // ✅ NEW: Handle sorting for search results
  private handleSearchSorting(sortBy: string, orderBy: 'asc' | 'desc'): void {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('sort_by', sortBy);
    currentUrl.searchParams.set('sort_order', orderBy);
    currentUrl.searchParams.set('page', '1'); // Reset to first page
    this.router.navigateByUrl(currentUrl.pathname + currentUrl.search);
  }

  navigateWithSort(sortBy: string, orderBy: 'asc' | 'desc'): void {
    this.updateQueryParams({ sortBy, orderBy, page: 1 });
  }

  updateQueryParams(params: { [key: string]: any }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }

  onPerPageChange(event: Event): void {
    const perPage = +(event.target as HTMLSelectElement).value;
    if (perPage > 0) {
      this.perPage = perPage;
      
      if (this.externalProducts) {
        // Handle per-page change for search results
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('per_page', perPage.toString());
        currentUrl.searchParams.set('page', '1');
        this.router.navigateByUrl(currentUrl.pathname + currentUrl.search);
      } else {
        this.updateQueryParams({ perPage, page: 1 });
      }
    }
  }

  addToCart(product: ProductModel): void {
    const variant = product.variants?.[0];
    if (variant) {
      this.cartService.addToCart(product, variant);
    }
  }

  clearCart(): void {
    this.cartService.clearCart();
  }

  // ✅ NEW: Helper to check if using external data
  isUsingExternalData(): boolean {
    return !!(this.externalProducts && this.externalPagination);
  }
}