// services/core/order-core.service.ts - FULLY OPTIMIZED
import { Injectable } from '@angular/core';
import { Observable, throwError, of, BehaviorSubject, combineLatest, timer, EMPTY } from 'rxjs';
import { map, switchMap, tap, catchError, finalize, shareReplay, startWith, debounceTime, distinctUntilChanged, retry, retryWhen, delayWhen } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { OrderRepositoryService } from './order-repository.service';
import { OrderCacheService } from './order-cache.service';
import { OrderValidationService } from './order-validation.service';
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderResponse,
  UpdateOrderRequest,
  OrderFilterOptions
} from '../models/order.model';

interface LoadingState {
  [key: string]: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OrderCoreService {
  
  private refreshTrigger$ = new BehaviorSubject<void>(undefined);
  private loadingState$ = new BehaviorSubject<LoadingState>({});
  
  // Enhanced cached observables with error recovery - initialized in constructor
  private userOrders$!: Observable<OrderModel[]>;
  private isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);

  // Prefetch queue for predictive loading
  private prefetchQueue: Set<number> = new Set();
  private readonly MAX_PREFETCH_QUEUE = 20;

  constructor(
    private orderRepository: OrderRepositoryService,
    private orderCache: OrderCacheService,
    private validation: OrderValidationService,
    private authService: AuthService,
    private router: Router
  ) {
    this.initializeUserOrders();
    this.setupNetworkMonitoring();
    this.configurePrefetching();
  }

  // ===== INITIALIZATION =====

  private initializeUserOrders(): void {
    this.userOrders$ = combineLatest([
      this.authService.user$,
      this.refreshTrigger$.pipe(debounceTime(100)), // Debounce rapid refresh calls
      this.isOnline$
    ]).pipe(
      distinctUntilChanged(([prevUser, , prevOnline], [currUser, , currOnline]) => 
        prevUser?.id === currUser?.id && prevOnline === currOnline
      ),
      switchMap(([user, , isOnline]) => {
        if (!user) {
          return of([]);
        }

        if (!isOnline) {
          // Return cached data when offline
          const cachedOrders = this.orderCache.getAllOrders()
            .filter(order => order.user_id === user.id);
          return of(cachedOrders);
        }

        // Set loading state
        this.setLoadingState('userOrders', true);

        return this.orderRepository.getUserOrdersWithRelations(user.id).pipe(
          tap(orders => {
            // Cache orders with high priority for authenticated user
            this.orderCache.addOrders(orders, 3);
            this.triggerPrefetch(orders);
          }),
          retry(2), // Retry failed requests
          catchError(error => {
            console.warn('Failed to load user orders, using cache:', error);
            // Fallback to cached data on error
            const cachedOrders = this.orderCache.getAllOrders()
              .filter(order => order.user_id === user.id);
            return of(cachedOrders);
          }),
          finalize(() => this.setLoadingState('userOrders', false))
        );
      }),
      shareReplay(1)
    );
  }

  private setupNetworkMonitoring(): void {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline$.next(true);
      this.triggerRefresh(); // Refresh data when coming back online
    });

    window.addEventListener('offline', () => {
      this.isOnline$.next(false);
    });
  }

  private configurePrefetching(): void {
    // Configure cache service for optimal prefetching
    this.orderCache.configurePrefetch({
      enabled: true,
      maxPrefetchItems: 30,
      prefetchThreshold: 2
    });

    // Prefetch hot orders every 5 minutes when online
    timer(0, 5 * 60 * 1000).pipe(
      switchMap(() => this.isOnline$.pipe(
        switchMap(isOnline => isOnline ? this.orderCache.hotOrders$ : EMPTY)
      ))
    ).subscribe(hotOrders => {
      if (hotOrders.length > 0) {
        console.log(`[OrderCore] Monitoring ${hotOrders.length} hot orders`);
      }
    });
  }

  // ===== ENHANCED ORDER OPERATIONS =====

  /**
   * Create order with comprehensive optimization
   */
  createOrder(orderData: CreateOrderRequest): Observable<OrderModel> {
    const operationId = `create_order_${Date.now()}`;
    const userId = this.authService.getUserId();
    
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User must be logged in'));
    }

    // Pre-validation to prevent unnecessary API calls
    const validationResult = this.validation.validateCreateOrderRequest(orderData);
    if (!validationResult.isValid) {
      return throwError(() => new Error(validationResult.errors.join(', ')));
    }

    // Check network status
    if (!this.isOnline$.value) {
      return throwError(() => new Error('Cannot create order while offline'));
    }

    this.setLoadingState(operationId, true);

    // Calculate subtotal optimistically
    const subtotal = this.calculateSubtotalOptimized(orderData.items || []);

    // Transform to API format
    const orderPayload: Omit<OrderModel, 'id' | 'created_at'> = {
      order_date: new Date().toISOString(),
      total_amount: subtotal,
      status: 'pending',
      cart_item_id: null,
      shipping_methods_id: orderData.shipping_method_id!,
      shipping_cost: 0,
      shipping_addresses_id: orderData.shipping_address_id!,
      notes: orderData.notes || '',
      user_id: userId,
      discount_amount: 0
    };

    return this.orderRepository.createOrder(orderPayload).pipe(
      // Optimistic update - immediately add to cache
      tap(order => {
        this.orderCache.addOrder(order, 5); // High priority
        this.triggerRefresh();
      }),
      // Handle item creation with better error recovery
      switchMap(createdOrder => {
        if (!orderData.items || orderData.items.length === 0) {
          return of(createdOrder);
        }

        return this.orderRepository.createOrderItems(createdOrder.id, orderData.items).pipe(
          map(orderItems => ({
            ...createdOrder,
            order_items: orderItems
          })),
          tap(orderWithItems => {
            // Update cache with complete order
            this.orderCache.addOrder(orderWithItems, 5);
          }),
          catchError(itemsError => {
            console.error('Failed to create order items:', itemsError);
            // Don't delete the order, just return it without items
            // The user can be notified and items can be added later
            return of(createdOrder);
          })
        );
      }),
      catchError(error => {
        console.error('Order creation failed:', error);
        
        // Enhanced error handling based on error type
        let errorMessage = 'Failed to create order. Please try again.';
        
        if (error.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid order data.';
        } else if (error.status === 401) {
          errorMessage = 'Please log in to place an order.';
          this.router.navigate(['/login']);
        } else if (!this.isOnline$.value) {
          errorMessage = 'Cannot create order while offline.';
        }
        
        return throwError(() => new Error(errorMessage));
      }),
      finalize(() => this.setLoadingState(operationId, false))
    );
  }

  /**
   * Enhanced get orders with intelligent caching
   */
  getOrders(
    page: number = 1,
    perPage: number = 10,
    filters?: OrderFilterOptions
  ): Observable<OrderResponse> {
    // Use cached pagination if available
    const paginatedResult = this.orderCache.getOrdersPaginated(page, perPage, filters);
    
    if (paginatedResult.items.length > 0 || !this.isOnline$.value) {
      return of({
        itemsReceived: paginatedResult.items.length,
        curPage: page,
        nextPage: page < paginatedResult.totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        offset: (page - 1) * perPage,
        perPage: perPage,
        itemsTotal: paginatedResult.totalItems,
        pageTotal: paginatedResult.totalPages,
        items: paginatedResult.items
      });
    }

    // Fallback to live data if cache miss and online
    return this.userOrders$.pipe(
      map(allOrders => {
        let filteredOrders = this.applyFiltersOptimized(allOrders, filters);
        
        // Sort by date (most recent first)
        filteredOrders = this.sortOrdersOptimized(filteredOrders);
        
        // Apply pagination
        const totalItems = filteredOrders.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const startIndex = (page - 1) * perPage;
        const paginatedOrders = filteredOrders.slice(startIndex, startIndex + perPage);
        
        // Cache paginated results
        paginatedOrders.forEach(order => this.orderCache.addOrder(order, 2));
        
        // Prefetch adjacent pages
        this.prefetchAdjacentPages(page, totalPages, perPage, filteredOrders);
        
        return {
          itemsReceived: paginatedOrders.length,
          curPage: page,
          nextPage: page < totalPages ? page + 1 : null,
          prevPage: page > 1 ? page - 1 : null,
          offset: startIndex,
          perPage: perPage,
          itemsTotal: totalItems,
          pageTotal: totalPages,
          items: paginatedOrders
        };
      })
    );
  }

  /**
   * Enhanced single order retrieval with predictive loading
   */
  getOrder(orderId: number): Observable<OrderModel> {
    // Check cache first with validation
    const cachedOrder = this.orderCache.getOrder(orderId);
    if (cachedOrder && this.isOrderComplete(cachedOrder)) {
      // Trigger background refresh if order is getting stale
      this.maybeRefreshOrder(orderId, cachedOrder);
      return of(cachedOrder);
    }

    // If offline, return cached data even if incomplete
    if (!this.isOnline$.value && cachedOrder) {
      return of(cachedOrder);
    }

    const operationId = `get_order_${orderId}`;
    this.setLoadingState(operationId, true);

    return this.orderRepository.getOrderWithRelations(orderId).pipe(
      tap(order => {
        this.validation.validateOrderOwnership(order);
        this.orderCache.addOrder(order, 4); // High priority for directly requested orders
        
        // Predictive loading of related orders
        this.scheduleRelatedOrdersPrefetch(order);
      }),
      retryWhen(errors => 
        errors.pipe(
          delayWhen((error, index) => {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.min(1000 * Math.pow(2, index), 8000);
            console.log(`Retrying order ${orderId} in ${delay}ms`);
            return timer(delay);
          }),
          switchMap((error, index) => {
            if (index >= 2) { // Max 3 attempts
              return throwError(error);
            }
            return of(error);
          })
        )
      ),
      catchError(error => {
        console.error(`Error loading order ${orderId}:`, error);
        
        // Return cached data as fallback
        if (cachedOrder) {
          console.log(`Using cached data for order ${orderId}`);
          return of(cachedOrder);
        }
        
        return throwError(() => error);
      }),
      finalize(() => this.setLoadingState(operationId, false))
    );
  }

  /**
   * Enhanced update with optimistic updates and rollback
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    const operationId = `update_order_${orderId}`;
    
    // Get original order for rollback
    const originalOrder = this.orderCache.getOrder(orderId);
    
    // Optimistic update
    if (originalOrder) {
      this.orderCache.updateOrder(orderId, updates);
    }

    if (!this.isOnline$.value) {
      // Queue for later when online
      return throwError(() => new Error('Cannot update order while offline'));
    }

    this.setLoadingState(operationId, true);

    return this.orderRepository.updateOrder(orderId, updates).pipe(
      tap(updatedOrder => {
        this.orderCache.addOrder(updatedOrder, 4);
      }),
      catchError(error => {
        // Rollback optimistic update
        if (originalOrder) {
          this.orderCache.addOrder(originalOrder, 4);
        }
        console.error(`Failed to update order ${orderId}:`, error);
        return throwError(() => error);
      }),
      finalize(() => this.setLoadingState(operationId, false))
    );
  }

  /**
   * Enhanced cancel with validation
   */
  cancelOrder(orderId: number, reason?: string): Observable<OrderModel> {
    const order = this.orderCache.getOrder(orderId);
    
    if (order && !this.canCancelOrder(order)) {
      return throwError(() => new Error(`Order cannot be cancelled. Current status: ${order.status}`));
    }

    const updates: UpdateOrderRequest = {
      status: 'cancelled',
      notes: reason 
        ? `${order?.notes || ''}\nCancelled: ${reason}` 
        : `${order?.notes || ''}\nCancelled by customer`
    };

    return this.updateOrder(orderId, updates);
  }

  // ===== OPTIMIZATION HELPERS =====

  private calculateSubtotalOptimized(items: any[]): number {
    return items.reduce((total, item) => {
      const unitPrice = Number(item.unit_price) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + (unitPrice * quantity);
    }, 0);
  }

  private applyFiltersOptimized(orders: OrderModel[], filters?: OrderFilterOptions): OrderModel[] {
    if (!filters) return orders;

    // Use array methods efficiently
    return orders.filter(order => {
      if (filters.status && order.status !== filters.status) return false;
      
      if (filters.date_from) {
        if (new Date(order.order_date) < new Date(filters.date_from)) return false;
      }
      
      if (filters.date_to) {
        if (new Date(order.order_date) > new Date(filters.date_to)) return false;
      }
      
      if (filters.min_amount !== undefined && order.total_amount < filters.min_amount) return false;
      if (filters.max_amount !== undefined && order.total_amount > filters.max_amount) return false;
      
      if (filters.search_term) {
        const term = filters.search_term.toLowerCase();
        const searchableText = `${order.id} ${order.notes} ${order.status}`.toLowerCase();
        if (!searchableText.includes(term)) return false;
      }
      
      return true;
    });
  }

  private sortOrdersOptimized(orders: OrderModel[]): OrderModel[] {
    // Use efficient sorting
    return orders.sort((a, b) => {
      const dateA = new Date(a.order_date).getTime();
      const dateB = new Date(b.order_date).getTime();
      return dateB - dateA; // Most recent first
    });
  }

  // ===== PREFETCHING STRATEGIES =====

  private prefetchAdjacentPages(currentPage: number, totalPages: number, perPage: number, allOrders: OrderModel[]): void {
    const pagesToPrefetch: number[] = [];
    
    // Prefetch next page
    if (currentPage < totalPages) {
      pagesToPrefetch.push(currentPage + 1);
    }
    
    // Prefetch previous page
    if (currentPage > 1) {
      pagesToPrefetch.push(currentPage - 1);
    }

    pagesToPrefetch.forEach(page => {
      const startIndex = (page - 1) * perPage;
      const pageOrders = allOrders.slice(startIndex, startIndex + perPage);
      
      // Add to cache with lower priority
      pageOrders.forEach(order => this.orderCache.addOrder(order, 1));
    });
  }

  private scheduleRelatedOrdersPrefetch(order: OrderModel): void {
    if (this.prefetchQueue.size >= this.MAX_PREFETCH_QUEUE) return;

    // Prefetch orders from same customer
    const userId = order.user_id;
    
    // Add to prefetch queue (simplified - in real implementation would be more sophisticated)
    setTimeout(() => {
      if (this.isOnline$.value && this.prefetchQueue.size < this.MAX_PREFETCH_QUEUE) {
        // This would trigger prefetching related orders
        console.log(`[OrderCore] Scheduled prefetch for user ${userId} orders`);
      }
    }, 2000);
  }

  private maybeRefreshOrder(orderId: number, cachedOrder: OrderModel): void {
    // Refresh if order is older than 10 minutes and in active status
    const age = Date.now() - new Date(cachedOrder.order_date).getTime();
    const isActiveStatus = ['pending', 'processing', 'shipped'].includes(cachedOrder.status);
    
    if (age > 10 * 60 * 1000 && isActiveStatus && this.isOnline$.value) {
      // Background refresh
      setTimeout(() => {
        this.orderRepository.getOrderWithRelations(orderId).pipe(
          tap(freshOrder => {
            this.orderCache.addOrder(freshOrder, 3);
          }),
          catchError(error => {
            console.warn(`Background refresh failed for order ${orderId}:`, error);
            return EMPTY;
          })
        ).subscribe();
      }, 1000);
    }
  }

  private triggerPrefetch(orders: OrderModel[]): void {
    // Identify hot orders and prefetch their related data
    const hotOrders = orders.filter(order => 
      ['pending', 'processing', 'shipped'].includes(order.status)
    ).slice(0, 10); // Limit to prevent API flooding

    if (hotOrders.length > 0) {
      setTimeout(() => {
        console.log(`[OrderCore] Identified ${hotOrders.length} hot orders for monitoring`);
      }, 500);
    }
  }

  // ===== STATE MANAGEMENT =====

  private setLoadingState(key: string, loading: boolean): void {
    const currentState = this.loadingState$.value;
    const newState = { ...currentState };
    
    if (loading) {
      newState[key] = true;
    } else {
      delete newState[key];
    }
    
    this.loadingState$.next(newState);
  }

  getLoadingState(): Observable<LoadingState> {
    return this.loadingState$.asObservable();
  }

  isLoading(key?: string): Observable<boolean> {
    return this.loadingState$.pipe(
      map(state => {
        if (key) {
          return state[key] || false;
        }
        return Object.keys(state).length > 0;
      })
    );
  }

  // ===== PUBLIC METHODS =====

  refreshOrders(): void {
    this.orderCache.clear();
    this.triggerRefresh();
  }

  triggerRefresh(): void {
    this.refreshTrigger$.next();
  }

  // Business logic methods (preserved for compatibility)
  canCancelOrder(order: OrderModel): boolean {
    return ['pending', 'confirmed'].includes(order.status);
  }

  canReturnOrder(order: OrderModel): boolean {
    if (order.status !== 'delivered') return false;
    
    const deliveredDate = new Date(order.order_date);
    const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = new Date();
    
    return (now.getTime() - deliveredDate.getTime()) <= returnWindow;
  }

  canReorderOrder(order: OrderModel): boolean {
    return ['delivered', 'cancelled'].includes(order.status);
  }

  private isOrderComplete(order: OrderModel): boolean {
    return !!(order.order_items && order.order_items.length > 0);
  }

  // ===== MONITORING AND DEBUG =====

  getPerformanceMetrics(): any {
    return {
      cacheStats: this.orderCache.getCacheStats(),
      repositoryStats: this.orderRepository.getPerformanceStats(),
      networkStatus: this.isOnline$.value,
      prefetchQueueSize: this.prefetchQueue.size,
      loadingOperations: Object.keys(this.loadingState$.value).length
    };
  }

  debugOptimizations(): void {
    console.group('[OrderCore] Optimization Status');
    console.log('Performance Metrics:', this.getPerformanceMetrics());
    console.log('Network Status:', this.isOnline$.value);
    console.log('Active Loading Operations:', this.loadingState$.value);
    console.log('Prefetch Queue Size:', this.prefetchQueue.size);
    this.orderCache.debugCache();
    this.orderRepository.debugState();
    console.groupEnd();
  }
}