// services/core/order-repository.service.ts - OPTIMIZED FOR RATE LIMITING
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, BehaviorSubject, EMPTY } from 'rxjs';
import { map, delay, finalize, catchError, tap, shareReplay, retry, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { 
  OrderModel, 
  OrderItem, 
  CreateOrderRequest, 
  OrderItemRequest,
  PaymentModel,
  PaymentRequest,
  ShippingAddress,
  ShippingMethod,
  ShippingStatus,
  UpdateOrderRequest
} from '../models/order.model';

interface QueuedRequest {
  id: string;
  request: () => Observable<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderRepositoryService {
  private apiUrl: string;
  
  // Request queue for rate limiting
  private requestQueue: QueuedRequest[] = [];
  private processingQueue = false;
  private readonly REQUEST_DELAY = 3100; // 3.1 seconds between requests (safe for 10 requests per 20 seconds)
  private readonly MAX_QUEUE_SIZE = 50;
  private requestCount = 0;
  private lastResetTime = Date.now();
  private readonly RESET_INTERVAL = 20000; // 20 seconds

  // Request deduplication
  private pendingRequests = new Map<string, Observable<any>>();
  
  // Cache for frequently accessed data
  private dataCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes
  
  // Performance monitoring
  private performanceStats = {
    totalRequests: 0,
    queuedRequests: 0,
    cachedResponses: 0,
    failedRequests: 0,
    averageResponseTime: 0
  };

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.apiUrl = environment.apiBaseUrl;
    this.startRateLimitReset();
  }

  // ===== RATE LIMITING QUEUE SYSTEM =====

  private startRateLimitReset(): void {
    setInterval(() => {
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }, this.RESET_INTERVAL);
  }

  private canMakeRequest(): boolean {
    return this.requestCount < 8; // Keep below 10 to be safe
  }

  private queueRequest<T>(
    key: string, 
    request: () => Observable<T>, 
    priority: number = 1,
    useCache: boolean = true
  ): Observable<T> {
    // Check cache first
    if (useCache && this.hasValidCache(key)) {
      this.performanceStats.cachedResponses++;
      return of(this.getFromCache(key));
    }

    // Check for duplicate requests
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    return new Observable<T>(subscriber => {
      const queueItem: QueuedRequest = {
        id: key,
        request,
        resolve: (value: T) => {
          this.cacheResponse(key, value);
          subscriber.next(value);
          subscriber.complete();
        },
        reject: (error: any) => {
          this.performanceStats.failedRequests++;
          subscriber.error(error);
        },
        timestamp: Date.now(),
        priority
      };

      // Check if we can make the request immediately
      if (this.canMakeRequest() && !this.processingQueue) {
        this.executeRequest(queueItem);
      } else {
        // Add to queue if not at capacity
        if (this.requestQueue.length < this.MAX_QUEUE_SIZE) {
          this.requestQueue.push(queueItem);
          this.performanceStats.queuedRequests++;
          this.sortQueue();
        } else {
          subscriber.error(new Error('Request queue is full. Please try again later.'));
        }
      }

      this.processQueue();
    }).pipe(
      shareReplay(1),
      finalize(() => this.pendingRequests.delete(key))
    );
  }

  private sortQueue(): void {
    this.requestQueue.sort((a, b) => {
      // Sort by priority (higher first), then by timestamp (older first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  private processQueue(): void {
    if (this.processingQueue || this.requestQueue.length === 0 || !this.canMakeRequest()) {
      return;
    }

    this.processingQueue = true;
    const queueItem = this.requestQueue.shift()!;
    
    setTimeout(() => {
      this.executeRequest(queueItem);
      this.processingQueue = false;
      this.processQueue(); // Process next item
    }, this.REQUEST_DELAY);
  }

  private executeRequest(queueItem: QueuedRequest): void {
    const startTime = Date.now();
    this.requestCount++;
    this.performanceStats.totalRequests++;

    this.pendingRequests.set(queueItem.id, queueItem.request());
    
    queueItem.request().pipe(
      retry(2), // Retry failed requests
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.updateAverageResponseTime(responseTime);
      }),
      catchError(error => {
        console.error(`API request failed for ${queueItem.id}:`, error);
        if (error.status === 429) {
          // Rate limited - add delay and retry
          return of(null).pipe(
            delay(5000),
            switchMap(() => queueItem.request())
          );
        }
        throw error;
      })
    ).subscribe({
      next: (data) => queueItem.resolve(data),
      error: (error) => queueItem.reject(error)
    });
  }

  private updateAverageResponseTime(responseTime: number): void {
    const { totalRequests, averageResponseTime } = this.performanceStats;
    this.performanceStats.averageResponseTime = 
      ((averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
  }

  // ===== CACHING SYSTEM =====

  private cacheResponse(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.dataCache.set(key, {
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: Date.now(),
      ttl
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  private hasValidCache(key: string): boolean {
    const cached = this.dataCache.get(key);
    if (!cached) return false;
    
    return Date.now() - cached.timestamp < cached.ttl;
  }

  private getFromCache(key: string): any {
    const cached = this.dataCache.get(key);
    return cached ? JSON.parse(JSON.stringify(cached.data)) : null;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.dataCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.dataCache.delete(key);
      }
    }
  }

  private invalidateCache(pattern: string): void {
    for (const key of this.dataCache.keys()) {
      if (key.includes(pattern)) {
        this.dataCache.delete(key);
      }
    }
  }

  // ===== OPTIMIZED ORDER OPERATIONS =====

  /**
   * Create order - HIGH PRIORITY
   */
  createOrder(orderData: Omit<OrderModel, 'id' | 'created_at'>): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.createOrder}`;
    const headers = this.getAuthHeaders();
    
    const request = () => this.http.post<OrderModel>(url, orderData, { headers });
    
    return this.queueRequest(
      `create_order_${Date.now()}`, 
      request, 
      5, // High priority
      false // Don't cache create operations
    ).pipe(
      tap(() => {
        // Invalidate related caches
        this.invalidateCache('user_orders');
        this.invalidateCache('order_analytics');
      })
    );
  }

  /**
   * Get orders with enhanced caching
   */
  getUserOrdersWithRelations(userId: number): Observable<OrderModel[]> {
    const cacheKey = `user_orders_${userId}_full`;
    
    const request = () => forkJoin({
      orders: this.getAllOrders(),
      allOrderItems: this.getAllOrderItems(),
      allShippingStatuses: this.http.get<ShippingStatus[]>(`${this.apiUrl}/shipping_status`, { headers: this.getAuthHeaders() }),
      allPayments: this.http.get<PaymentModel[]>(`${this.apiUrl}/payment`, { headers: this.getAuthHeaders() })
    }).pipe(
      map(({ orders, allOrderItems, allShippingStatuses, allPayments }) => {
        return orders
          .filter(order => order.user_id === userId)
          .map(order => ({
            ...order,
            order_items: allOrderItems.filter(item => item.order_id === order.id),
            shipping_status: allShippingStatuses.find(status => status.order_id === order.id),
            payment: allPayments.find(payment => payment.order_id === order.id)
          }));
      })
    );

    return this.queueRequest(cacheKey, request, 2);
  }

  /**
   * Get single order with relations - cached
   */
  getOrderWithRelations(orderId: number): Observable<OrderModel> {
    const cacheKey = `order_${orderId}_with_relations`;
    
    const request = () => forkJoin({
      order: this.getOrderById(orderId),
      orderItems: this.getOrderItemsByOrderId(orderId),
      shippingStatus: this.getShippingStatusByOrderId(orderId),
      payments: this.getPaymentByOrderId(orderId)
    }).pipe(
      map(({ order, orderItems, shippingStatus, payments }) => ({
        ...order,
        order_items: orderItems,
        shipping_status: shippingStatus[0] || null,
        payment: payments[0] || null
      }))
    );

    return this.queueRequest(cacheKey, request, 3);
  }

  /**
   * Get all orders - heavily cached
   */
  getAllOrders(): Observable<OrderModel[]> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getUserOrders}`;
    const headers = this.getAuthHeaders();
    const cacheKey = 'all_orders';
    
    const request = () => this.http.get<OrderModel[]>(url, { headers });
    
    return this.queueRequest(cacheKey, request, 2);
  }

  /**
   * Get order by ID - cached
   */
  getOrderById(orderId: number): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getOrder}/${orderId}`;
    const headers = this.getAuthHeaders();
    const cacheKey = `order_${orderId}`;
    
    const request = () => this.http.get<OrderModel>(url, { headers });
    
    return this.queueRequest(cacheKey, request, 3);
  }

  /**
   * Update order - invalidates cache
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.updateOrderStatus}/${orderId}`;
    const headers = this.getAuthHeaders();
    
    const request = () => this.http.patch<OrderModel>(url, updates, { headers });
    
    return this.queueRequest(
      `update_order_${orderId}_${Date.now()}`, 
      request, 
      4, // High priority
      false // Don't cache updates
    ).pipe(
      tap(() => {
        // Invalidate related caches
        this.invalidateCache(`order_${orderId}`);
        this.invalidateCache('user_orders');
      })
    );
  }

  /**
   * Delete order - invalidates cache
   */
  deleteOrder(orderId: number): Observable<any> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.cancelOrder}/${orderId}`;
    const headers = this.getAuthHeaders();
    
    const request = () => this.http.delete(url, { headers });
    
    return this.queueRequest(
      `delete_order_${orderId}_${Date.now()}`, 
      request, 
      4,
      false
    ).pipe(
      tap(() => {
        this.invalidateCache(`order_${orderId}`);
        this.invalidateCache('user_orders');
      })
    );
  }

  // ===== ORDER ITEM OPERATIONS =====

  createOrderItem(orderItemData: Omit<OrderItem, 'id' | 'created_at'>): Observable<OrderItem> {
    const url = `${this.apiUrl}/order_items`;
    const headers = this.getAuthHeaders();
    
    const request = () => this.http.post<OrderItem>(url, orderItemData, { headers });
    
    return this.queueRequest(
      `create_item_${orderItemData.order_id}_${Date.now()}`, 
      request, 
      4,
      false
    );
  }

  createOrderItems(orderId: number, items: OrderItemRequest[]): Observable<OrderItem[]> {
    // Batch create items to reduce API calls
    const createRequests = items.map((item, index) => {
      const orderItemData = {
        order_id: orderId,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      };
      
      return this.queueRequest(
        `create_item_${orderId}_${index}_${Date.now()}`,
        () => this.http.post<OrderItem>(`${this.apiUrl}/order_items`, orderItemData, { headers: this.getAuthHeaders() }),
        4,
        false
      );
    });

    return forkJoin(createRequests);
  }

  getAllOrderItems(): Observable<OrderItem[]> {
    const url = `${this.apiUrl}/order_items`;
    const headers = this.getAuthHeaders();
    const cacheKey = 'all_order_items';
    
    const request = () => this.http.get<OrderItem[]>(url, { headers });
    
    return this.queueRequest(cacheKey, request, 1);
  }

  getOrderItemsByOrderId(orderId: number): Observable<OrderItem[]> {
    const cacheKey = `order_items_${orderId}`;
    
    const request = () => this.getAllOrderItems().pipe(
      map(items => items.filter(item => item.order_id === orderId))
    );
    
    return this.queueRequest(cacheKey, request, 2);
  }

  // ===== PAYMENT OPERATIONS =====

  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.processPayment}`;
    const headers = this.getAuthHeaders();
    
    const request = () => this.http.post<PaymentModel>(url, paymentData, { headers });
    
    return this.queueRequest(
      `process_payment_${paymentData.order_id}_${Date.now()}`, 
      request, 
      5, // Highest priority
      false
    );
  }

  getPaymentById(paymentId: number): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.getPaymentStatus}/${paymentId}`;
    const headers = this.getAuthHeaders();
    const cacheKey = `payment_${paymentId}`;
    
    const request = () => this.http.get<PaymentModel>(url, { headers });
    
    return this.queueRequest(cacheKey, request, 3);
  }

  getPaymentByOrderId(orderId: number): Observable<PaymentModel[]> {
    const cacheKey = `payment_order_${orderId}`;
    
    const request = () => this.http.get<PaymentModel[]>(`${this.apiUrl}/payment`, { headers: this.getAuthHeaders() }).pipe(
      map(payments => payments.filter(payment => payment.order_id === orderId))
    );
    
    return this.queueRequest(cacheKey, request, 2);
  }

  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.refundPayment}/${paymentId}/refund`;
    const headers = this.getAuthHeaders();
    const payload = { amount, reason };
    
    const request = () => this.http.post<PaymentModel>(url, payload, { headers });
    
    return this.queueRequest(
      `refund_${paymentId}_${Date.now()}`, 
      request, 
      4,
      false
    );
  }

  // ===== SHIPPING OPERATIONS =====

  getShippingMethods(): Observable<ShippingMethod[]> {
    const url = `${this.apiUrl}/shipping_methods`;
    const headers = this.getAuthHeaders();
    const cacheKey = 'shipping_methods';
    
    const request = () => this.http.get<ShippingMethod[]>(url, { headers });
    
    // Cache shipping methods for 1 hour as they rarely change
    return this.queueRequest(cacheKey, request, 1, true).pipe(
      tap(methods => this.cacheResponse(cacheKey, methods, 60 * 60 * 1000))
    );
  }

  getActiveShippingMethods(): Observable<ShippingMethod[]> {
    return this.getShippingMethods().pipe(
      map(methods => methods.filter(method => method.is_active))
    );
  }

  getShippingMethodById(methodId: number): Observable<ShippingMethod> {
    const cacheKey = `shipping_method_${methodId}`;
    
    const request = () => this.getShippingMethods().pipe(
      map(methods => {
        const method = methods.find(m => m.id === methodId);
        if (!method) throw new Error(`Shipping method ${methodId} not found`);
        return method;
      })
    );
    
    return this.queueRequest(cacheKey, request, 2);
  }

  getShippingAddresses(): Observable<ShippingAddress[]> {
    const url = `${this.apiUrl}/shipping_addresses`;
    const headers = this.getAuthHeaders();
    const cacheKey = 'shipping_addresses';
    
    const request = () => this.http.get<ShippingAddress[]>(url, { headers });
    
    return this.queueRequest(cacheKey, request, 2);
  }

  getShippingAddressesByUserId(userId: number): Observable<ShippingAddress[]> {
    const cacheKey = `shipping_addresses_user_${userId}`;
    
    const request = () => this.getShippingAddresses().pipe(
      map(addresses => addresses.filter(addr => addr.user_id === userId && addr.is_active))
    );
    
    return this.queueRequest(cacheKey, request, 2);
  }

  getShippingStatusByOrderId(orderId: number): Observable<ShippingStatus[]> {
    const url = `${this.apiUrl}/shipping_status`;
    const headers = this.getAuthHeaders();
    const cacheKey = `shipping_status_${orderId}`;
    
    const request = () => this.http.get<ShippingStatus[]>(url, { headers }).pipe(
      map(statuses => statuses.filter(status => status.order_id === orderId))
    );
    
    return this.queueRequest(cacheKey, request, 2);
  }

  // ===== UTILITY METHODS =====

  private getAuthHeaders(): { [key: string]: string } {
    return {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };
  }

  // ===== PERFORMANCE MONITORING =====

  getPerformanceStats(): any {
    return {
      ...this.performanceStats,
      queueSize: this.requestQueue.length,
      cacheSize: this.dataCache.size,
      requestsInCurrentWindow: this.requestCount,
      timeUntilReset: this.RESET_INTERVAL - (Date.now() - this.lastResetTime)
    };
  }

  getQueueStats(): any {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.processingQueue,
      requestsThisWindow: this.requestCount,
      maxRequests: 8,
      nextResetIn: this.RESET_INTERVAL - (Date.now() - this.lastResetTime)
    };
  }

  // ===== EMERGENCY METHODS =====

  clearCache(): void {
    this.dataCache.clear();
    console.log('[OrderRepository] Cache cleared');
  }

  clearQueue(): void {
    this.requestQueue.length = 0;
    this.pendingRequests.clear();
    console.log('[OrderRepository] Request queue cleared');
  }

  forceProcessQueue(): void {
    this.processingQueue = false;
    this.processQueue();
  }

  // ===== BATCH OPERATIONS =====

  batchGetOrders(orderIds: number[]): Observable<OrderModel[]> {
    // Group into batches to avoid overwhelming the API
    const batchSize = 5;
    const batches = [];
    
    for (let i = 0; i < orderIds.length; i += batchSize) {
      batches.push(orderIds.slice(i, i + batchSize));
    }
    
    const batchRequests = batches.map(batch => 
      forkJoin(batch.map(id => this.getOrderById(id)))
    );
    
    return forkJoin(batchRequests).pipe(
      map(results => results.flat())
    );
  }

  // ===== DEBUG METHODS =====

  debugState(): void {
    console.group('[OrderRepository] Debug State');
    console.log('Performance Stats:', this.getPerformanceStats());
    console.log('Queue Stats:', this.getQueueStats());
    console.log('Cache Keys:', Array.from(this.dataCache.keys()));
    console.log('Pending Requests:', Array.from(this.pendingRequests.keys()));
    console.groupEnd();
  }
}