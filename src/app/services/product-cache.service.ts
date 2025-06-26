import { Injectable } from '@angular/core';
import { ProductModel, ProductResponse, ProductVariant } from '../models/product.model';
import { ProductService } from './product.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ProductCacheService {
  private readonly CACHE_KEY = 'ngc-products';
  private readonly CACHE_EXPIRY_MINUTES = 30;

  private cachedProducts: ProductModel[] = [];
  private cacheTimestamp: number = 0;
  private warnedCacheInvalid = false;

  constructor(
    private productService: ProductService,
    private toastr: ToastrService
  ) {
    this.loadCacheFromStorage();
  }

  private loadCacheFromStorage(): void {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.cachedProducts = parsed.products || [];
        this.cacheTimestamp = parsed.timestamp || 0;
        this.toastr.success('Product cache loaded from local storage.', 'Success');
      } catch {
        this.clearCache();
        this.toastr.error('Failed to parse cached product data.', 'Error');
      }
    } else {
      this.toastr.info('No cached product data found.', 'Info');
    }
  }

  private saveCacheToStorage(): void {
    try {
      localStorage.setItem(
        this.CACHE_KEY,
        JSON.stringify({
          products: this.cachedProducts,
          timestamp: this.cacheTimestamp,
        })
      );
      this.toastr.success('Product cache saved to local storage.', 'Success');
    } catch {
      this.toastr.error('Failed to save product cache.', 'Error');
    }
  }

  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_EXPIRY_MINUTES * 60 * 1000;
  }

  private updateCache(products: ProductModel[]): void {
    this.cachedProducts = products;
    this.cacheTimestamp = Date.now();
    this.warnedCacheInvalid = false;
    this.saveCacheToStorage();
  }

  private async ensureCache(): Promise<void> {
    if (this.cachedProducts.length && this.isCacheValid()) return;

    if (!this.warnedCacheInvalid) {
      this.toastr.warning('Product cache expired or empty. Reloading...', 'Warning');
      this.warnedCacheInvalid = true;
    }

    try {
      const res = await this.productService.getProducts(1, 1000, 'id', 'asc').toPromise();
      if (res?.items?.length) {
        this.updateCache(res.items);
        this.toastr.success('Product data fetched and cached successfully.', 'Success');
      } else {
        this.toastr.warning('Empty product list received from server.', 'Warning');
      }
    } catch (err) {
      this.toastr.error('Failed to load product cache', 'Error');
      console.error(err);
    }
  }

  private sortByTotalSold(products: ProductModel[]): ProductModel[] {
    return [...products].sort((a, b) => {
      const aSold = this.getTotalSoldFromVariants(a);
      const bSold = this.getTotalSoldFromVariants(b);
      return bSold - aSold;
    });
  }

  async getPaginatedProducts(
    page: number = 1,
    perPage: number = 6,
    sortBy: string = 'id',
    orderBy: 'asc' | 'desc' = 'asc',
    categoryId?: number | null,
    minPrice?: number,
    maxPrice?: number,
    filterType?: 'featured' | 'new' | 'best-sell' | 'discounted'
  ): Promise<ProductResponse> {
    await this.ensureCache();

    let filtered = [...this.cachedProducts];

    switch (filterType) {
      case 'featured':
        filtered = filtered.filter(p => p.isFeatured);
        break;
      case 'new':
        filtered = filtered.filter(p => p.isNewArrival);
        break;
      case 'best-sell':
        filtered = this.sortByTotalSold(filtered);
        break;
      case 'discounted':
        filtered = filtered.filter(p =>
          p.variants?.some(v => (v.discountPrice ?? 0) < (v.price ?? 0))
        );
        break;
    }

    if (categoryId != null) {
      filtered = filtered.filter(p => p.category_id === categoryId);
    }

    if (minPrice != null) {
      filtered = filtered.filter(p => p.price >= minPrice);
    }

    if (maxPrice != null) {
      filtered = filtered.filter(p => p.price <= maxPrice);
    }

    filtered = filtered.sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal < bVal) return orderBy === 'asc' ? -1 : 1;
      if (aVal > bVal) return orderBy === 'asc' ? 1 : -1;
      return 0;
    });

    const itemsTotal = filtered.length;
    const offset = (page - 1) * perPage;
    const paginatedItems = filtered.slice(offset, offset + perPage);
    const pageTotal = Math.ceil(itemsTotal / perPage);

    if (paginatedItems.length === 0) {
      this.toastr.warning('No products found for the current filter or page.', 'Warning');
    } else {
      this.toastr.success(`${paginatedItems.length} products loaded.`, 'Success');
    }

    return {
      itemsReceived: paginatedItems.length,
      curPage: page,
      nextPage: page < pageTotal ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
      offset,
      perPage,
      itemsTotal,
      pageTotal,
      items: paginatedItems,
    };
  }

  getAllProducts(): Observable<ProductModel[]> {
    if (!this.isCacheValid() && !this.warnedCacheInvalid) {
      this.toastr.warning('Product cache expired. Reloading.', 'Warning');
      this.warnedCacheInvalid = true;
    }
    return of([...this.cachedProducts]);
  }

  getFeaturedProducts(): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map((products) => products.filter((p) => p.isFeatured))
    );
  }

  getNewProducts(): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map((products) => products.filter((p) => p.isNewArrival))
    );
  }

  getProductsByPrice(min: number, max: number): ProductModel[] {
    const filtered = this.cachedProducts.filter((product) => {
      return product.variants?.some(
        (variant) => (variant.price ?? 0) >= min && (variant.price ?? 0) <= max
      );
    });
    if (filtered.length === 0) {
      this.toastr.info('No products found in this price range.', 'Info');
    } else {
      this.toastr.success(`${filtered.length} products found in price range.`, 'Success');
    }
    return filtered;
  }

  getBestSellingProducts(): ProductModel[] {
    const sorted = this.sortByTotalSold(this.cachedProducts);

    if (sorted.length === 0) {
      this.toastr.info('No best-selling products found.', 'Info');
    } else {
      this.toastr.success('Best-selling products sorted successfully.', 'Success');
    }

    return sorted;
  }

  getProductById(id: number): Observable<ProductModel> | undefined {
    const product = this.cachedProducts.find(p => p.id === id);
    if (!product) {
      this.toastr.warning('Product not found in cache.', 'Warning');
      return undefined;
    } else {
      this.toastr.success('Product loaded from cache.', 'Success');
      return of(product);
    }
  }   

  private getTotalSoldFromVariants(product: ProductModel): number {
    return (
      product.variants?.reduce((sum, v) => sum + (v.totalSold ?? 0), 0) ?? 0
    );
  }

  isInStock(product: ProductModel, variant?: ProductVariant): boolean {
    const targetVariant = variant || product.variants?.[0];
    return targetVariant ? targetVariant.stock > 0 : false;
  }

  clearCache(): void {
    this.cachedProducts = [];
    this.cacheTimestamp = 0;
    localStorage.removeItem(this.CACHE_KEY);
    this.toastr.info('Product cache has been cleared.', 'Info');
  }
}