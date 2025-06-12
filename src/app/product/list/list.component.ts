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

  private filtersChanged$ = new Subject<void>();

  constructor(
    private productCacheService: ProductCacheService,
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService
  ) {}

  ngOnInit(): void {
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
    if (changes['minPrice'] || changes['maxPrice'] || changes['categoryId']) {
      this.filtersChanged$.next();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async fetchProducts(): Promise<void> {
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
      this.productCountChanged.emit(this.filteredProducts.length);
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
      this.updateQueryParams({ page });
    }
  }

  onSortChange(): void {
    this.navigateWithSort(this.sortBy, this.orderBy);
  }

  toggleOrder(): void {
    this.orderBy = this.orderBy === 'asc' ? 'desc' : 'asc';
    this.navigateWithSort(this.sortBy, this.orderBy);
  }

  resetSort(): void {
    this.sortBy = 'id';
    this.orderBy = 'asc';
    this.navigateWithSort(this.sortBy, this.orderBy);
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
      this.updateQueryParams({ perPage, page: 1 });
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
}

