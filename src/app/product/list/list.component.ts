import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUp, faArrowDown, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { CardComponent } from '../card/card.component';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { ProductModel } from '../../models/product.model';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, FontAwesomeModule, CardComponent],
  templateUrl: './list.component.html',
  styleUrl: './list.component.scss'
})
export default class ListComponent implements OnInit, OnChanges {
  products: ProductModel[] = [];
  filteredProducts: ProductModel[] = [];
  loading = false;
  skeletonCount = Array(3);
  @Input() minPrice?: number;
  @Input() maxPrice?: number = 100;
  @Input() categoryId?: number | null;
  @Input() filterType: 'featured' | 'new' | null = null;
  @Output() productCountChanged = new EventEmitter<number>();

  currentPage = 1;
  totalPages = 1;
  pageNumbers: (number | string)[] = [];
  perPage: number = 6;

  sortBy: string = 'id';
  orderBy: 'asc' | 'desc' = 'asc';
  sortOptions = [
    { label: 'ID', value: 'id' },
    { label: 'Name', value: 'name' },
    { label: 'Price', value: 'price' },
    { label: 'Created At', value: 'created_at' }
  ];
  
  // Icons
  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  faRotateLeft = faRotateLeft;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute,
    private toastrService: ToastrService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.filteredProducts = this.products.filter(f => {
      if (this.maxPrice !== undefined && this.maxPrice !== null) {
        return f.price <= this.maxPrice;
      }
      return true; // include all if no maxPrice filter
    });
    this.productCountChanged.emit(this.filteredProducts.length);
    if (changes['categoryId'] && !changes['categoryId'].firstChange) {
      this.currentPage = 1;
      this.getProducts();
    }

    this.updateQueryParams({
      page: this.currentPage,
      perPage: this.perPage,
      sortBy: this.sortBy,
      orderBy: this.orderBy,
      categoryId: this.categoryId,
    });
  }

  ngOnInit(): void {
    // this.getProducts(this.currentPage);
    this.route.queryParams.subscribe((params) => {
      const pageParam = params['page'];
      this.filterType = params['filter'] || null;
      // this.currentPage = parseInt(params['page'], 10) || 1;
      // this.sortBy = params['sortBy'] || 'id';
      // this.orderBy = params['orderBy'] === 'desc' ? 'desc' : 'asc';

      this.currentPage = +params['page'] || 1;
      this.perPage = +params['perPage'] || 6;
      this.sortBy = params['sortBy'] || 'id';
      this.orderBy = params['orderBy'] === 'desc' ? 'desc' : 'asc';
      this.categoryId = params['categoryId'] ? +params['categoryId'] : null;
  
      if (!pageParam || isNaN(this.currentPage) || this.currentPage < 1) {
        // Redirect to page=1 if it's missing or invalid
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: 1 },
          queryParamsHandling: 'merge',
          replaceUrl: true, // avoid adding an extra entry in browser history
        });
      } else {
        if (this.filterType === 'featured') {
          this.getFeaturedProducts();
        } else if (this.filterType === 'new') {
          this.getNewProducts();
        } else {
          this.getProducts(this.currentPage, this.perPage, this.sortBy, this.orderBy, this.categoryId);
        }
      }
    });
  }

  getProducts(
    page: number = 1,
    perPage: number = this.perPage,
    sortBy: string = this.sortBy,
    orderBy: 'asc' | 'desc' = 'asc',
    categoryId: number | null = 1,
    minPrice?: number | null,
    maxPrice?: number | null
  ): void {
    this.loading = true;
  
    this.productService.getProducts(page, perPage, sortBy, orderBy, categoryId, this.minPrice ?? undefined, this.maxPrice ?? undefined).subscribe({
      next: (res) => {
        const { items, curPage, pageTotal } = res;
  
        // Handle invalid page early
        if (curPage > pageTotal && pageTotal > 0) {
          this.toastrService.warning(
            `Page ${curPage} doesn't exist — showing page ${pageTotal} instead.`,
            'Invalid Page'
          );
  
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: pageTotal },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
  
          return;
        }
  
        // Update data/state
        this.products = items;
        this.filteredProducts = items;
        this.currentPage = curPage;
        this.totalPages = pageTotal;
        console.log('categoryId in ProductListComponent:', this.categoryId);
        this.productCountChanged.emit(items.length);
        this.generatePageNumbers();
      },
      error: (err) => {
        console.error('Error fetching products:', err);
        this.toastrService.error('Failed to load products');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }  

  generatePageNumbers(): void {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 2; // how many pages to show on either side
    const range = [];
    const rangeWithDots = [];
    let l: number | undefined = undefined;
  
    range.push(1); // always include first page
  
    for (let i = current - delta; i <= current + delta; i++) {
      if (i > 1 && i < total) {
        range.push(i);
      }
    }
  
    if (total > 1) {
      range.push(total); // always include last page
    }
  
    for (let i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1); // no dots, just insert in-between page
        } else if (i - l > 2) {
          rangeWithDots.push('...'); // dots when gap is large
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
  
    this.pageNumbers = rangeWithDots;
  }  

  getFeaturedProducts(): void {
    this.loading = true;
    this.productService.getFeaturedProducts().subscribe({
      next: (res) => {
        console.log('Featured products response:', res);
        this.products = res.items; // ✅ items is an array
        this.filteredProducts = res.items; // ✅ same here
        console.log('Filtered Featured products response:', this.products);
      },
      error: (err) => {
        console.error('Error fetching featured products', err);
      },
      complete: () => this.loading = false,
    });    
  }
  
  getNewProducts(): void {
    this.loading = true;
    this.productService.getNewProducts().subscribe({
      next: (res) => {
        console.log('New products response:', res);
        this.products = res.items; // ✅ items is an array
        this.filteredProducts = res.items; // ✅ same here
      },
      error: (err) => {
        console.error('Error fetching new products', err);
      },
      complete: () => this.loading = false,
    });
  }  

  goToPage(page: any): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      // 👇 updates the URL without reloading
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page },
        queryParamsHandling: 'merge', // preserves other params
      });
    }
    this.updateQueryParams({ page });
  }  

  onSortChange(): void {
    this.navigateWithSort(this.sortBy, this.orderBy);
  }
  
  toggleOrder(): void {
    this.orderBy = this.orderBy === 'asc' ? 'desc' : 'asc';
    this.navigateWithSort(this.sortBy, this.orderBy);
  }
  
  private navigateWithSort(sortBy: string, orderBy: 'asc' | 'desc'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        sortBy,
        orderBy,
        page: 1 // Reset to page 1 on sort change
      },
      queryParamsHandling: 'merge'
    });
  }

  resetSort(): void {
    this.sortBy = 'id';
    this.orderBy = 'asc';
  
    this.navigateWithSort(this.sortBy, this.orderBy);
  }  

  updateQueryParams(params: { [key: string]: any }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge', // keep other params
    });
  }  

  onPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const perPage = +target.value;
    this.perPage = perPage;
    this.updateQueryParams({ perPage: this.perPage, page: 1 }); // Reset to page 1
  }  

  addToCart(product: ProductModel): void {
    const selectedVariant = product.variants?.[0]; // or show UI to pick one
    if (selectedVariant) {
      this.cartService.addToCart(product, selectedVariant);
    }
  }  

  clearCart():void {
    this.cartService.clearCart();
  }
}
