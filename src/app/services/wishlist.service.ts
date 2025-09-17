// services/wishlist.service.ts - Using ProductCacheService integration
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of, timer } from 'rxjs';
import { map, catchError, tap, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { WishlistModel, WishlistWithProduct, CreateWishlistRequest } from '../models/wishlist.model';
import { ProductModel } from '../models/product.model';
import { AuthService } from './auth.service';
import { ProductCacheService } from './product-cache.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private apiUrl: string;
  
  // Reactive wishlist state
  private wishlistSubject = new BehaviorSubject<WishlistWithProduct[]>([]);
  public wishlist$ = this.wishlistSubject.asObservable();
  
  private wishlistCountSubject = new BehaviorSubject<number>(0);
  public wishlistCount$ = this.wishlistCountSubject.asObservable();

  // Rate limiting - more conservative
  private lastApiCall = 0;
  private readonly MIN_API_INTERVAL = 2500; // 2.5 seconds between API calls

  // Loading state
  private isLoading = false;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private productCacheService: ProductCacheService // Inject your existing cache service
  ) {
    this.apiUrl = environment.apiBaseUrl;

    // Initialize wishlist when user logs in
    this.authService.user$.pipe(
      debounceTime(1000),
      distinctUntilChanged()
    ).subscribe(user => {
      if (user) {
        this.loadUserWishlist();
      } else {
        this.clearWishlistState();
      }
    });
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Rate limiting helper
  private rateLimitedCall<T>(apiCall: () => Observable<T>): Observable<T> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.MIN_API_INTERVAL) {
      const delayTime = this.MIN_API_INTERVAL - timeSinceLastCall;
      return timer(delayTime).pipe(
        tap(() => this.lastApiCall = Date.now()),
        switchMap(() => apiCall())
      );
    }
    
    this.lastApiCall = Date.now();
    return apiCall();
  }

  // SINGLE API CALL - Get wishlist items and use cache for product details
  loadUserWishlist(): void {
    if (this.isLoading) return;
    
    const currentUser = this.authService.getCurrentUserSync();
    if (!currentUser) {
      this.clearWishlistState();
      return;
    }

    this.isLoading = true;
    this.loadingSubject.next(true);

    // Only make ONE API call to get wishlist items
    this.rateLimitedCall(() => 
      this.http.get<any[]>(`${this.apiUrl}/${environment.apiEndpoints.wishlist.getWishlist}`, {
        headers: this.getHeaders()
      })
    ).pipe(
      map(response => {
        // Filter by current user's ID
        return Array.isArray(response) 
          ? response.filter(item => item.user_id === currentUser.id)
          : [];
      }),
      switchMap(wishlistItems => {
        if (wishlistItems.length === 0) {
          return of([]);
        }

        // Get all products from cache - NO additional API calls!
        return this.productCacheService.getAllProducts().pipe(
          map(cachedProducts => {
            // Match wishlist items with cached products
            return wishlistItems.map(wishlistItem => {
              const product = cachedProducts.find(p => p.id === wishlistItem.product_id);
              
              return {
                id: wishlistItem.id,
                created_at: wishlistItem.created_at,
                added_at: wishlistItem.added_at,
                user_id: wishlistItem.user_id,
                product_id: wishlistItem.product_id,
                product: product || this.createFallbackProduct(wishlistItem.product_id)
              } as WishlistWithProduct;
            });
          })
        );
      }),
      catchError(error => {
        console.error('Error fetching wishlist:', error);
        return of([]);
      })
    ).subscribe({
      next: (items) => {
        this.wishlistSubject.next(items);
        this.wishlistCountSubject.next(items.length);
      },
      error: (error) => {
        console.error('Error loading wishlist:', error);
        this.clearWishlistState();
      },
      complete: () => {
        this.isLoading = false;
        this.loadingSubject.next(false);
      }
    });
  }

  // Create fallback product when not found in cache
  private createFallbackProduct(productId: number): ProductModel {
    return {
      id: productId,
      created_at: 0,
      updated_at: 0,
      name: `Product ${productId}`,
      description: 'Product details unavailable. Please refresh the cache.',
      brand: 'Unknown',
      main_image_url: 'assets/images/image-not-loaded.jpg',
      slug: `product-${productId}`,
      isNewArrival: false,
      isFeatured: false,
      category_id: 0,
      price: 0,
      stock_quantity: 0,
      variants: [{
        id: 1,
        price: 0,
        discountPrice: 0,
        totalSold: 0,
        stock: 0,
        sku: `fallback-${productId}`,
        optionValues: {},
        weight: 0,
        product_images: []
      }],
      reviews: []
    };
  }

  // Add to wishlist with optimistic updates
  addToWishlist(productId: number): Observable<WishlistModel> {
    const currentUser = this.authService.getCurrentUserSync();
    if (!currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (this.isProductInWishlist(productId)) {
      return throwError(() => new Error('Product already in wishlist'));
    }

    const requestData: CreateWishlistRequest = {
      user_id: currentUser.id,
      product_id: productId,
      added_at: Math.floor(Date.now() / 1000)
    };

    // Optimistic update - add immediately to local state
    this.addOptimisticWishlistItem(productId, requestData);

    return this.rateLimitedCall(() =>
      this.http.post<WishlistModel>(`${this.apiUrl}/${environment.apiEndpoints.wishlist.addToWishlist}`, requestData, {
        headers: this.getHeaders()
      })
    ).pipe(
      tap((response) => {
        // Update with real data from server
        this.updateOptimisticWishlistItem(productId, response);
      }),
      catchError(error => {
        console.error('Error adding to wishlist:', error);
        // Remove optimistic item on error
        this.removeOptimisticWishlistItem(productId);
        return throwError(() => error);
      })
    );
  }

  // Optimistic update helpers
  private addOptimisticWishlistItem(productId: number, requestData: CreateWishlistRequest): void {
    // Get product from cache
    const cachedProducts = this.productCacheService.getProductsSync();
    const product = cachedProducts.find(p => p.id === productId);

    if (product) {
      const optimisticItem: WishlistWithProduct = {
        id: Date.now(), // Temporary ID
        created_at: Date.now(),
        added_at: requestData.added_at,
        user_id: requestData.user_id,
        product_id: productId,
        product: product
      };

      const current = this.wishlistSubject.value;
      this.wishlistSubject.next([...current, optimisticItem]);
      this.wishlistCountSubject.next(current.length + 1);
    }
  }

  private updateOptimisticWishlistItem(productId: number, serverData: WishlistModel): void {
    const current = this.wishlistSubject.value;
    const updated = current.map(item => {
      if (item.product_id === productId && item.id > 1000000000) { // Temp ID
        return { ...item, id: serverData.id, created_at: serverData.created_at };
      }
      return item;
    });
    this.wishlistSubject.next(updated);
  }

  private removeOptimisticWishlistItem(productId: number): void {
    const current = this.wishlistSubject.value;
    const updated = current.filter(item => item.product_id !== productId);
    this.wishlistSubject.next(updated);
    this.wishlistCountSubject.next(updated.length);
  }

  // Remove wishlist item
  removeWishlistItem(wishlistId: number): Observable<boolean> {
    // Optimistic update
    const currentWishlist = this.wishlistSubject.value;
    const updatedWishlist = currentWishlist.filter(item => item.id !== wishlistId);
    this.wishlistSubject.next(updatedWishlist);
    this.wishlistCountSubject.next(updatedWishlist.length);

    return this.rateLimitedCall(() =>
      this.http.delete(`${this.apiUrl}/${environment.apiEndpoints.wishlist.removeWishlistItem}/${wishlistId}`, {
        headers: this.getHeaders()
      })
    ).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error removing wishlist item:', error);
        // Revert optimistic update on error
        this.loadUserWishlist();
        return throwError(() => error);
      })
    );
  }

  // Clear entire wishlist
  clearWishlist(): Observable<boolean> {
    const currentWishlist = this.wishlistSubject.value;
    
    // Clear optimistically
    this.wishlistSubject.next([]);
    this.wishlistCountSubject.next(0);

    if (currentWishlist.length === 0) {
      return of(true);
    }

    // Remove items one by one with delays to avoid rate limits
    const removePromises = currentWishlist.map((item, index) => 
      timer(index * this.MIN_API_INTERVAL).pipe(
        switchMap(() => this.removeWishlistItem(item.id)),
        catchError(() => of(false))
      ).toPromise()
    );

    return new Observable(observer => {
      Promise.all(removePromises).then(results => {
        const allSuccess = results.every(result => result === true);
        if (!allSuccess) {
          this.loadUserWishlist(); // Reload on partial failure
        }
        observer.next(allSuccess);
        observer.complete();
      }).catch(error => {
        console.error('Error clearing wishlist:', error);
        this.loadUserWishlist();
        observer.error(error);
      });
    });
  }

  // Toggle wishlist status
  toggleWishlist(productId: number): Observable<boolean> {
    if (this.isProductInWishlist(productId)) {
      return this.removeFromWishlist(productId);
    } else {
      return this.addToWishlist(productId).pipe(map(() => true));
    }
  }

  // Remove by product ID
  removeFromWishlist(productId: number): Observable<boolean> {
    const currentWishlist = this.wishlistSubject.value;
    const wishlistItem = currentWishlist.find(item => 
      item.product_id === productId || item.product?.id === productId
    );

    if (!wishlistItem) {
      return throwError(() => new Error('Product not found in wishlist'));
    }

    return this.removeWishlistItem(wishlistItem.id);
  }

  // Check if product is in wishlist (synchronous)
  isProductInWishlist(productId: number): boolean {
    const currentWishlist = this.wishlistSubject.value;
    return currentWishlist.some(item => 
      item.product_id === productId || item.product?.id === productId
    );
  }

  // Get current wishlist count (synchronous)
  getWishlistCount(): number {
    return this.wishlistCountSubject.value;
  }

  // Get current wishlist items (synchronous)
  getCurrentWishlist(): WishlistWithProduct[] {
    return this.wishlistSubject.value;
  }

  // Check if user is authenticated
  isUserAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }

  // Clear local wishlist state
  private clearWishlistState(): void {
    this.wishlistSubject.next([]);
    this.wishlistCountSubject.next(0);
    this.isLoading = false;
    this.loadingSubject.next(false);
  }

  // Helper method to refresh product cache if needed
  ensureProductCacheLoaded(): Promise<void> {
    return this.productCacheService.ensureCache();
  }

  // Refresh wishlist (useful when cache is updated)
  refreshWishlist(): void {
    if (this.authService.isLoggedIn()) {
      this.loadUserWishlist();
    }
  }
}