import { Injectable } from '@angular/core';
import { ProductModel, ProductResponse, ProductVariant } from '../models/product.model';
import { ProductService } from './product.service';
import { PricingService } from './pricing.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ProductCacheService {
  private readonly CACHE_KEY = 'ngc-products';
  private readonly CACHE_EXPIRY_MINUTES = 30;

  private cachedProducts: ProductModel[] = [];
  private cacheTimestamp: number = 0;
  private warnedCacheInvalid = false;
  private isLoading = false;
  
  // Add BehaviorSubject to track cache state
  private cacheStateSubject = new BehaviorSubject<{
    products: ProductModel[];
    isLoading: boolean;
    isLoaded: boolean;
    lastUpdated: number;
  }>({
    products: [],
    isLoading: false,
    isLoaded: false,
    lastUpdated: 0
  });

  cacheState$ = this.cacheStateSubject.asObservable();

  constructor(
    private productService: ProductService,
    private toastr: ToastrService,
    private pricingService: PricingService
  ) {
    console.log('ProductCacheService initialized');
    this.loadCacheFromStorage();
  }

  private loadCacheFromStorage(): void {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.cachedProducts = parsed.products || [];
        this.cacheTimestamp = parsed.timestamp || 0;
        
        console.log(`Loaded ${this.cachedProducts.length} products from cache`);
        
        this.updateCacheState();
        this.toastr.success('Product cache loaded from local storage.', 'Success');
      } catch (error) {
        console.error('Failed to parse cached data:', error);
        this.clearCache();
        this.toastr.error('Failed to parse cached product data.', 'Error');
      }
    } else {
      console.log('No cached product data found');
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
      console.log(`Saved ${this.cachedProducts.length} products to cache`);
      this.toastr.success('Product cache saved to local storage.', 'Success');
    } catch (error) {
      console.error('Failed to save cache:', error);
      this.toastr.error('Failed to save product cache.', 'Error');
    }
  }

  private isCacheValid(): boolean {
    const isValid = Date.now() - this.cacheTimestamp < this.CACHE_EXPIRY_MINUTES * 60 * 1000;
    console.log('Cache validity check:', {
      isValid,
      cacheAge: Date.now() - this.cacheTimestamp,
      expiryMs: this.CACHE_EXPIRY_MINUTES * 60 * 1000
    });
    return isValid;
  }

  private updateCacheState(): void {
    this.cacheStateSubject.next({
      products: [...this.cachedProducts],
      isLoading: this.isLoading,
      isLoaded: this.cachedProducts.length > 0,
      lastUpdated: this.cacheTimestamp
    });
  }

  private updateCache(products: ProductModel[]): void {
    this.cachedProducts = products;
    this.cacheTimestamp = Date.now();
    this.warnedCacheInvalid = false;
    this.saveCacheToStorage();
    this.updateCacheState();
  }

  // Make ensureCache method public and return a Promise
  public ensureCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('ensureCache called - checking cache status');
      
      // If cache is valid and has data, resolve immediately
      if (this.cachedProducts.length && this.isCacheValid()) {
        console.log('Cache is valid and has data, resolving immediately');
        resolve();
        return;
      }

      // If already loading, wait for current loading to complete
      if (this.isLoading) {
        console.log('Cache is already loading, waiting...');
        const subscription = this.cacheState$.subscribe(state => {
          if (!state.isLoading) {
            subscription.unsubscribe();
            if (state.isLoaded) {
              resolve();
            } else {
              reject(new Error('Failed to load cache'));
            }
          }
        });
        return;
      }

      // Start loading
      this.isLoading = true;
      this.updateCacheState();

      if (!this.warnedCacheInvalid) {
        this.toastr.warning('Product cache expired or empty. Reloading...', 'Warning');
        this.warnedCacheInvalid = true;
      }

      console.log('Fetching products from API...');
      this.productService.getProducts(1, 1000, 'id', 'asc').subscribe({
        next: (res) => {
          console.log('API response received:', res);
          
          if (res?.items?.length) {
            this.updateCache(res.items);
            this.toastr.success('Product data fetched and cached successfully.', 'Success');
            resolve();
          } else {
            this.toastr.warning('Empty product list received from server.', 'Warning');
            reject(new Error('Empty product list'));
          }
          
          this.isLoading = false;
          this.updateCacheState();
        },
        error: (err) => {
          console.error('Error fetching products:', err);
          this.toastr.error('Failed to load product cache', 'Error');
          this.isLoading = false;
          this.updateCacheState();
          reject(err);
        }
      });
    });
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
    try {
      await this.ensureCache();
    } catch (error) {
      console.error('Failed to ensure cache in getPaginatedProducts:', error);
      // Continue with empty cache
    }

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
        // Use PricingService to filter products with valid discounts
        filtered = this.pricingService.filterDiscountedProducts(filtered);
        break;
    }

    if (categoryId != null) {
      filtered = filtered.filter(p => p.category_id === categoryId);
    }

    if (minPrice != null || maxPrice != null) {
      // Use PricingService for price filtering with effective prices
      filtered = this.pricingService.filterByPriceRange(
        filtered, 
        minPrice ?? 0, 
        maxPrice ?? Infinity
      );
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

    if (paginatedItems.length === 0 && itemsTotal > 0) {
      this.toastr.warning('No products found for the current filter or page.', 'Warning');
    } else if (paginatedItems.length > 0) {
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
    console.log('getAllProducts called');
    
    // Return current products immediately, but also ensure cache is updated
    if (!this.isCacheValid() && !this.warnedCacheInvalid && !this.isLoading) {
      console.log('Cache is invalid, starting background refresh');
      this.ensureCache().catch(err => console.error('Background cache refresh failed:', err));
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
    // Use PricingService for filtering by effective prices
    const filtered = this.pricingService.filterByPriceRange(this.cachedProducts, min, max);
    
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
    this.warnedCacheInvalid = false;
    this.isLoading = false;
    localStorage.removeItem(this.CACHE_KEY);
    this.updateCacheState();
    this.toastr.info('Product cache has been cleared.', 'Info');
  }

  // Get discounted products using PricingService
  getDiscountedProducts(): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => this.pricingService.filterDiscountedProducts(products))
    );
  }

  // Public method to check if cache is loaded
  isCacheLoaded(): boolean {
    return this.cachedProducts.length > 0;
  }

  // Public method to get cache info
  getCacheInfo() {
    return {
      productCount: this.cachedProducts.length,
      isValid: this.isCacheValid(),
      lastUpdated: this.cacheTimestamp,
      isLoading: this.isLoading,
      cacheAgeMs: Date.now() - this.cacheTimestamp,
      expiryMs: this.CACHE_EXPIRY_MINUTES * 60 * 1000
    };
  }

  // Force refresh cache
  forceRefresh(): Promise<void> {
    console.log('Force refreshing cache...');
    this.clearCache();
    return this.ensureCache();
  }

  // Preload cache (useful for app initialization)
  preloadCache(): void {
    console.log('Preloading cache...');
    if (!this.isCacheLoaded() || !this.isCacheValid()) {
      this.ensureCache().catch(err => {
        console.error('Failed to preload cache:', err);
      });
    }
  }

  // Get products by category
  getProductsByCategory(categoryId: number): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => products.filter(p => p.category_id === categoryId))
    );
  }

  // Search products by name or description
  searchProducts(query: string): Observable<ProductModel[]> {
    const lowerQuery = query.toLowerCase();
    return this.getAllProducts().pipe(
      map(products => products.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description?.toLowerCase().includes(lowerQuery) ||
        p.brand?.toLowerCase().includes(lowerQuery)
      ))
    );
  }

  // Get products with variants in stock
  getInStockProducts(): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => products.filter(p => this.isInStock(p)))
    );
  }

  // Get product statistics with pricing service integration
  getProductStatistics() {
    const products = this.cachedProducts;
    const totalProducts = products.length;
    const featuredCount = products.filter(p => p.isFeatured).length;
    const newArrivalsCount = products.filter(p => p.isNewArrival).length;
    const inStockCount = products.filter(p => this.isInStock(p)).length;
    const discountedCount = this.pricingService.filterDiscountedProducts(products).length;

    // Use effective prices for statistics
    const prices = products.flatMap(p => 
      p.variants?.map(v => this.pricingService.getEffectivePrice(v)) || []
    ).filter(price => price > 0);

    const avgPrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const categories = [...new Set(products.map(p => p.category_id))];

    return {
      totalProducts,
      featuredCount,
      newArrivalsCount,
      inStockCount,
      discountedCount,
      avgPrice: Math.round(avgPrice * 100) / 100,
      minPrice,
      maxPrice,
      categoriesCount: categories.length,
      cacheInfo: this.getCacheInfo()
    };
  }

  // Method for debugging - get all products as array (not observable)
  getProductsSync(): ProductModel[] {
    return [...this.cachedProducts];
  }

  // Method to validate product data integrity
  validateCacheIntegrity(): boolean {
    try {
      const products = this.cachedProducts;
      
      // Check if products array is valid
      if (!Array.isArray(products)) {
        console.error('Cache integrity check failed: products is not an array');
        return false;
      }

      // Check each product has required fields
      for (const product of products) {
        if (!product.id || !product.name) {
          console.error('Cache integrity check failed: product missing required fields', product);
          return false;
        }

        // Check variants structure
        if (product.variants && !Array.isArray(product.variants)) {
          console.error('Cache integrity check failed: variants is not an array', product);
          return false;
        }
      }

      console.log('Cache integrity check passed');
      return true;
    } catch (error) {
      console.error('Cache integrity check failed with error:', error);
      return false;
    }
  }

  // Sort products by price using effective prices
  sortProductsByPrice(products: ProductModel[] = this.cachedProducts, ascending: boolean = true): ProductModel[] {
    return this.pricingService.sortByPrice(products, ascending);
  }

  // Sort products by discount percentage
  sortProductsByDiscount(products: ProductModel[] = this.cachedProducts): ProductModel[] {
    return this.pricingService.sortByDiscountPercentage(products);
  }

  // Get products in a specific price range
  getProductsInPriceRange(min: number, max: number): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => this.pricingService.filterByPriceRange(products, min, max))
    );
  }

  // Get price range for all products
  getOverallPriceRange(): { min: number; max: number; hasRange: boolean } {
    const products = this.cachedProducts;
    if (!products.length) {
      return { min: 0, max: 0, hasRange: false };
    }

    const allPrices = products.flatMap(product => 
      product.variants?.map(variant => this.pricingService.getEffectivePrice(variant)) || []
    ).filter(price => price > 0);

    if (!allPrices.length) {
      return { min: 0, max: 0, hasRange: false };
    }

    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);

    return { min, max, hasRange: min !== max };
  }

  // Get products by brand
  getProductsByBrand(brand: string): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => products.filter(p => 
        p.brand?.toLowerCase() === brand.toLowerCase()
      ))
    );
  }

  // Get all unique brands
  getAllBrands(): string[] {
    const brands = this.cachedProducts
      .map(p => p.brand)
      .filter((brand): brand is string => !!brand);
    
    return [...new Set(brands)].sort();
  }

  // Get products with specific stock level
  getProductsByStockLevel(minStock: number = 1): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => products.filter(p => 
        p.variants?.some(variant => variant.stock >= minStock) ?? false
      ))
    );
  }

  // Get low stock products
  getLowStockProducts(threshold: number = 10): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => products.filter(p => 
        p.variants?.some(variant => variant.stock > 0 && variant.stock <= threshold) ?? false
      ))
    );
  }

  // Get out of stock products
  getOutOfStockProducts(): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => products.filter(p => !this.isInStock(p)))
    );
  }

  // Advanced search with multiple filters
  advancedSearch(filters: {
    query?: string;
    categoryId?: number;
    brandName?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    discountedOnly?: boolean;
    featured?: boolean;
    newArrival?: boolean;
  }): Observable<ProductModel[]> {
    return this.getAllProducts().pipe(
      map(products => {
        let filtered = [...products];

        // Text search
        if (filters.query) {
          const lowerQuery = filters.query.toLowerCase();
          filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description?.toLowerCase().includes(lowerQuery) ||
            p.brand?.toLowerCase().includes(lowerQuery)
          );
        }

        // Category filter
        if (filters.categoryId) {
          filtered = filtered.filter(p => p.category_id === filters.categoryId);
        }

        // Brand filter
        if (filters.brandName) {
          filtered = filtered.filter(p => 
            p.brand?.toLowerCase() === filters.brandName?.toLowerCase()
          );
        }

        // Price range filter using effective prices
        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
          filtered = this.pricingService.filterByPriceRange(
            filtered,
            filters.minPrice ?? 0,
            filters.maxPrice ?? Infinity
          );
        }

        // Stock filter
        if (filters.inStockOnly) {
          filtered = filtered.filter(p => this.isInStock(p));
        }

        // Discount filter
        if (filters.discountedOnly) {
          filtered = this.pricingService.filterDiscountedProducts(filtered);
        }

        // Featured filter
        if (filters.featured) {
          filtered = filtered.filter(p => p.isFeatured);
        }

        // New arrival filter
        if (filters.newArrival) {
          filtered = filtered.filter(p => p.isNewArrival);
        }

        return filtered;
      })
    );
  }
}