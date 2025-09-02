import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of, forkJoin, from } from 'rxjs';
import { tap, catchError, switchMap, map, delay, finalize, concatMap, toArray } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PricingService } from './pricing.service';
import { environment } from '../../environments/environment';
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderResponse, 
  OrderStatus,
  PaymentRequest,
  PaymentModel,
  UpdateOrderRequest,
  OrderFilterOptions,
  OrderSummary,
  OrderAnalytics,
  InvoiceModel,
  ReturnRequest,
  OrderTrackingEvent,
  PromotionModel,
  OrderItemRequest
} from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl: string;
  
  // Current order state for checkout process
  private currentOrderSubject = new BehaviorSubject<Partial<CreateOrderRequest> | null>(null);
  currentOrder$ = this.currentOrderSubject.asObservable();

  // Order cache for performance
  private orderCacheSubject = new BehaviorSubject<OrderModel[]>([]);
  orderCache$ = this.orderCacheSubject.asObservable();

  // Order summary for quick access
  private orderSummarySubject = new BehaviorSubject<OrderSummary[]>([]);
  orderSummary$ = this.orderSummarySubject.asObservable();

  // Track loaded order items to prevent duplicate requests
  private loadedOrderItems = new Set<number>();
  
  // Track loading states
  orderItemsLoading = new Set<number>();

  // Mock promotions data
  private mockPromotions: PromotionModel[] = [
    {
      id: 1,
      created_at: Date.now(),
      code: 'SAVE10',
      description: '10% off orders over $50',
      discount_type: 'percentage',
      discount_value: 10,
      minimum_order_amount: 50,
      maximum_discount_amount: 100,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: 1000,
      usage_count: 0,
      is_active: true,
      applicable_products: undefined,
      applicable_categories: undefined
    },
    {
      id: 2,
      created_at: Date.now(),
      code: 'SAVE20',
      description: '20% off orders over $100',
      discount_type: 'percentage',
      discount_value: 20,
      minimum_order_amount: 100,
      maximum_discount_amount: 200,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: 500,
      usage_count: 0,
      is_active: true,
      applicable_products: undefined,
      applicable_categories: undefined
    },
    {
      id: 3,
      created_at: Date.now(),
      code: 'FREESHIP',
      description: 'Free shipping on all orders',
      discount_type: 'free_shipping',
      discount_value: 0,
      minimum_order_amount: undefined,
      maximum_discount_amount: undefined,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: undefined,
      usage_count: 0,
      is_active: true,
      applicable_products: undefined,
      applicable_categories: undefined
    },
    {
      id: 4,
      created_at: Date.now(),
      code: 'WELCOME25',
      description: '$25 off orders over $75',
      discount_type: 'fixed_amount',
      discount_value: 25,
      minimum_order_amount: 75,
      maximum_discount_amount: undefined,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: 100,
      usage_count: 0,
      is_active: true,
      applicable_products: undefined,
      applicable_categories: undefined
    },
    {
      id: 5,
      created_at: Date.now(),
      code: 'VIP50',
      description: '$50 off orders over $200',
      discount_type: 'fixed_amount',
      discount_value: 50,
      minimum_order_amount: 200,
      maximum_discount_amount: undefined,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: 50,
      usage_count: 0,
      is_active: true,
      applicable_products: undefined,
      applicable_categories: undefined
    },
    {
      id: 6,
      created_at: Date.now(),
      code: 'ELECTRONICS15',
      description: '15% off electronics category',
      discount_type: 'percentage',
      discount_value: 15,
      minimum_order_amount: 50,
      maximum_discount_amount: 150,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: 200,
      usage_count: 0,
      is_active: true,
      applicable_products: undefined,
      applicable_categories: [1]
    }
  ];

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private pricingService: PricingService,
    private authService: AuthService,
    private router: Router
  ) {
    this.apiUrl = environment.apiBaseUrl;
  }

  /**
   * Create a new order using separate API calls - Updated for dual endpoint approach
   */
  createOrder(orderData: CreateOrderRequest): Observable<OrderModel> {
    // Validate required data first
    if (!orderData.shipping_address_id || !orderData.shipping_method_id || !orderData.items || orderData.items.length === 0) {
      const error = 'Missing required order data: shipping address, shipping method, or items';
      this.toastr.error(error, 'Validation Error');
      return throwError(() => new Error(error));
    }

    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User must be logged in to create orders'));
    }

    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    // Calculate totals
    const subtotal = this.calculateSubtotalWithPricing(orderData.items);
    
    // Step 1: Create the main order (without items)
    const orderPayload = {
      order_date: new Date().toISOString(),
      total_amount: subtotal,
      status: 'pending' as OrderStatus,
      cart_item_id: null,
      shipping_methods_id: orderData.shipping_method_id,
      shipping_cost: 0, // Will be calculated by backend
      shipping_addresses_id: orderData.shipping_address_id,
      notes: orderData.notes || '',
      user_id: userId
    };

    console.log('Creating order with payload:', orderPayload);
    
    const orderUrl = `${this.apiUrl}/${environment.apiEndpoints.order.createOrder}`;
    
    return this.http.post<OrderModel>(orderUrl, orderPayload, { headers }).pipe(
      switchMap((createdOrder: OrderModel) => {
        console.log('Order created successfully:', createdOrder);
        
        if (!createdOrder || !createdOrder.id) {
          throw new Error('Order creation failed - no order ID returned');
        }

        // Step 2: Create order items sequentially using separate endpoint
        return this.createOrderItemsSequentially(createdOrder.id, orderData.items, headers).pipe(
          map((orderItems) => {
            // Return the complete order with items
            const completeOrder: OrderModel = {
              ...createdOrder,
              order_items: orderItems
            };
            console.log('Complete order with items:', completeOrder);
            return completeOrder;
          }),
          catchError((itemsError) => {
            console.error('Failed to create order items:', itemsError);
            
            // Step 3: Rollback - Delete the order if items creation fails
            console.log('Rolling back order due to items creation failure...');
            return this.rollbackOrder(createdOrder.id, headers).pipe(
              switchMap(() => throwError(() => new Error(`Order cancelled: ${itemsError.message}`)))
            );
          })
        );
      }),
      tap(order => {
        // Clear current order after successful creation
        this.currentOrderSubject.next(null);
        
        // Update cache
        this.addOrderToCache(order);
        
        this.toastr.success('Order placed successfully!', 'Success');
      }),
      catchError(error => {
        console.error('Order creation failed:', error);
        
        let errorMessage = 'Failed to create order. Please try again.';
        if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid order data. Please check your information.';
        } else if (error.status === 401) {
          errorMessage = 'Please log in to place an order.';
          this.router.navigate(['/login']);
        } else if (error.message?.includes('Order cancelled:')) {
          errorMessage = 'Order creation was cancelled due to an error.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.toastr.error(errorMessage, 'Order Creation Failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Create order items sequentially using POST /order_items endpoint
   */
  private createOrderItemsSequentially(orderId: number, items: OrderItemRequest[], headers: any): Observable<any[]> {
    const itemsUrl = `${this.apiUrl}/order_items`;
    
    console.log(`Creating ${items.length} order items for order ${orderId}`);
    
    // Create order items one by one
    const createItemObservables = items.map((item, index) => {
      const orderItemData = {
        order_id: orderId,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        created_at: Date.now()
      };

      console.log(`Creating order item ${index + 1}:`, orderItemData);

      return this.http.post<any>(itemsUrl, orderItemData, { headers }).pipe(
        tap(createdItem => {
          console.log(`Order item ${index + 1} created successfully:`, createdItem);
        }),
        catchError(error => {
          console.error(`Failed to create order item ${index + 1}:`, error);
          return throwError(() => new Error(`Failed to create item ${index + 1}: ${error.message || 'Unknown error'}`));
        })
      );
    });

    // Execute all item creation requests sequentially with forkJoin
    return forkJoin(createItemObservables).pipe(
      tap(createdItems => {
        console.log('All order items created successfully:', createdItems);
      }),
      catchError(error => {
        console.error('Some order items failed to create:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Rollback order creation using DELETE /order/{order_id}
   */
  private rollbackOrder(orderId: number, headers: any): Observable<any> {
    console.log('Rolling back order:', orderId);
    
    const deleteUrl = `${this.apiUrl}/${environment.apiEndpoints.order.cancelOrder}/${orderId}`;
    
    return this.http.delete(deleteUrl, { headers }).pipe(
      tap(() => {
        console.log('Order successfully rolled back:', orderId);
        this.toastr.warning('Order creation failed and has been cancelled', 'Order Cancelled');
      }),
      catchError(rollbackError => {
        console.error('Failed to rollback order:', rollbackError);
        this.toastr.error('Order creation failed and rollback also failed. Please contact support.', 'Critical Error');
        return of(null); // Continue with the flow even if rollback fails
      })
    );
  }

  /**
   * Alternative: Create items with delay between requests (if API has rate limits)
   */
  private createOrderItemsWithDelay(orderId: number, items: OrderItemRequest[], headers: any): Observable<any[]> {
    const itemsUrl = `${this.apiUrl}/order_items`;
    
    // Create items one by one with delay
    return from(items).pipe(
      concatMap((item, index) => {
        const orderItemData = {
          order_id: orderId,
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          created_at: Date.now()
        };

        console.log(`Creating order item ${index + 1} with delay:`, orderItemData);

        return this.http.post<any>(itemsUrl, orderItemData, { headers }).pipe(
          delay(100), // 100ms delay between requests
          tap(createdItem => {
            console.log(`Order item ${index + 1} created:`, createdItem);
          })
        );
      }),
      toArray(), // Collect all results into array
      tap(createdItems => {
        console.log('All order items created with delay:', createdItems);
      })
    );
  }

  /**
   * Get user's orders with enhanced loading strategy
   */
  getUserOrders(
    page: number = 1,
    perPage: number = 10,
    filters?: OrderFilterOptions
  ): Observable<OrderResponse> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => ({ message: 'User not authenticated' }));
    }

    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getUserOrders}`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.get<OrderModel[]>(url, { headers }).pipe(
      switchMap(allOrders => {
        console.log('Loaded all orders:', allOrders.length);
        
        // Filter orders for current user
        let userOrders = allOrders.filter(order => order.user_id === userId);
        
        // Apply additional filters if provided
        if (filters?.status) {
          userOrders = userOrders.filter(order => order.status === filters.status);
        }
        if (filters?.date_from) {
          userOrders = userOrders.filter(order => 
            new Date(order.order_date) >= new Date(filters.date_from!)
          );
        }
        if (filters?.date_to) {
          userOrders = userOrders.filter(order => 
            new Date(order.order_date) <= new Date(filters.date_to!)
          );
        }
        if (filters?.min_amount) {
          userOrders = userOrders.filter(order => order.total_amount >= filters.min_amount!);
        }
        if (filters?.max_amount) {
          userOrders = userOrders.filter(order => order.total_amount <= filters.max_amount!);
        }
        if (filters?.search_term) {
          const searchTerm = filters.search_term.toLowerCase();
          userOrders = userOrders.filter(order => 
            order.id.toString().includes(searchTerm) ||
            order.notes.toLowerCase().includes(searchTerm)
          );
        }
        
        // Sort by date (newest first)
        userOrders.sort((a, b) => 
          new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
        );
        
        // Calculate pagination
        const totalItems = userOrders.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const paginatedOrders = userOrders.slice(startIndex, endIndex);
        
        // Strategy: Load order details for visible orders automatically
        const ordersWithItemsRequests = paginatedOrders.map(order => {
          // If order already has items, return as-is
          if (order.order_items && order.order_items.length > 0) {
            return of(order);
          }
          
          // Otherwise, fetch detailed order information
          return this.getOrder(order.id).pipe(
            catchError(error => {
              console.warn(`Failed to load details for order ${order.id}:`, error);
              return of(order); // Return basic order if detail fetch fails
            })
          );
        });
        
        // If we have orders to load details for, do it
        if (ordersWithItemsRequests.length > 0) {
          return forkJoin(ordersWithItemsRequests).pipe(
            map(detailedOrders => ({
              itemsReceived: detailedOrders.length,
              curPage: page,
              nextPage: page < totalPages ? page + 1 : null,
              prevPage: page > 1 ? page - 1 : null,
              offset: startIndex,
              perPage: perPage,
              itemsTotal: totalItems,
              pageTotal: totalPages,
              items: detailedOrders
            }))
          );
        } else {
          // No orders to process
          return of({
            itemsReceived: 0,
            curPage: page,
            nextPage: null,
            prevPage: null,
            offset: 0,
            perPage: perPage,
            itemsTotal: 0,
            pageTotal: 0,
            items: []
          });
        }
      }),
      tap(response => {
        console.log(`Loaded ${response.items.length} orders for page ${page}`);
        
        // Update cache with new orders
        this.updateOrderCache(response.items);
        
        // Update order summary
        const summaries = response.items.map(order => this.mapOrderToSummary(order));
        this.orderSummarySubject.next(summaries);
      }),
      catchError(error => {
        console.error('Error loading orders:', error);
        this.toastr.error('Failed to load orders', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Load order items on demand for specific order
   */
  loadOrderItems(orderId: number): void {
    if (this.loadedOrderItems.has(orderId) || this.orderItemsLoading.has(orderId)) {
      return;
    }
    
    this.orderItemsLoading.add(orderId);
    
    this.getOrder(orderId).pipe(
      finalize(() => this.orderItemsLoading.delete(orderId))
    ).subscribe({
      next: (detailedOrder) => {
        const orderIndex = this.orderCacheSubject.value.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
          const updatedOrders = [...this.orderCacheSubject.value];
          updatedOrders[orderIndex] = detailedOrder;
          this.orderCacheSubject.next(updatedOrders);
          this.loadedOrderItems.add(orderId);
        }
      },
      error: (error) => {
        console.warn(`Failed to load items for order ${orderId}:`, error);
      }
    });
  }

  /**
   * Check if order items are currently loading
   */
  isLoadingOrderItems(orderId: number): boolean {
    return this.orderItemsLoading.has(orderId);
  }

  /**
   * Get specific order by ID with all related data
   */
  getOrder(orderId: number): Observable<OrderModel> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => ({ message: 'User not authenticated' }));
    }

    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getOrder}/${orderId}`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.get<OrderModel>(url, { headers }).pipe(
      map(order => {
        // Security check: Verify order belongs to current user
        if (order.user_id !== userId) {
          throw new Error('Access denied: Order does not belong to current user');
        }
        return order;
      }),
      tap(order => {
        this.addOrderToCache(order);
      }),
      catchError(error => {
        console.error('Error loading order details:', error);
        if (error.message?.includes('Access denied')) {
          this.toastr.error('You can only view your own orders', 'Access Denied');
        } else {
          this.toastr.error('Failed to load order details', 'Error');
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Update order status and other details
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.updateOrderStatus}/${orderId}`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.patch<OrderModel>(url, updates, { headers }).pipe(
      tap(updatedOrder => {
        this.updateOrderInCache(updatedOrder);
        this.toastr.success('Order updated successfully', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Failed to update order', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Cancel order
   */
  cancelOrder(orderId: number, reason?: string): Observable<OrderModel> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => ({ message: 'User not authenticated' }));
    }

    // First verify the order belongs to the user and can be cancelled
    return this.getOrder(orderId).pipe(
      switchMap(order => {
        // Check if order can be cancelled
        if (!this.canCancelOrder(order)) {
          throw new Error('Order cannot be cancelled. Current status: ' + order.status);
        }

        const url = `${this.apiUrl}/${environment.apiEndpoints.order.updateOrderStatus}/${orderId}`;
        const headers = {
          'Authorization': `Bearer ${this.authService.getToken()}`,
          'Content-Type': 'application/json'
        };
        
        const payload = {
          status: 'cancelled' as OrderStatus,
          notes: reason ? `${order.notes}\nCancelled by customer: ${reason}` : `${order.notes}\nCancelled by customer`
        };
        
        return this.http.patch<OrderModel>(url, payload, { headers });
      }),
      tap(cancelledOrder => {
        this.updateOrderInCache(cancelledOrder);
        this.toastr.success('Order cancelled successfully', 'Success');
      }),
      catchError(error => {
        console.error('Error cancelling order:', error);
        if (error.message?.includes('cannot be cancelled')) {
          this.toastr.error(error.message, 'Cannot Cancel Order');
        } else if (error.message?.includes('Access denied')) {
          this.toastr.error('You can only cancel your own orders', 'Access Denied');
        } else {
          this.toastr.error('Failed to cancel order', 'Error');
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Get items from previous order for reordering
   */
  getReorderItems(orderId: number): Observable<any[]> {
    return this.getOrder(orderId).pipe(
      map(order => {
        if (!order.order_items || order.order_items.length === 0) {
          throw new Error('No items found in this order');
        }
        
        // Transform order items to cart format using correct field names
        return order.order_items.map(item => ({
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: item.quantity,
          product_name: item.product?.name || 'Unknown Product',
          current_price: item.unit_price,
          image_url: item.product?.main_image_url || '',
          brand: item.product?.brand || '',
          in_stock: true
        }));
      }),
      catchError(error => {
        console.error('Error loading reorder items:', error);
        this.toastr.error('Failed to load reorder items', 'Error');
        return throwError(() => error);
      })
    );
  }

  // ===== PAYMENT OPERATIONS =====

  /**
   * Process payment for an order
   */
  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.processPayment}`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.post<PaymentModel>(url, paymentData, { headers }).pipe(
      tap(payment => {
        if (payment.status === 'completed') {
          this.toastr.success('Payment processed successfully', 'Success');
        } else if (payment.status === 'pending') {
          this.toastr.info('Payment is being processed', 'Info');
        }
      }),
      catchError(error => {
        this.toastr.error('Payment processing failed', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get payment status (API method)
   */
  getPaymentStatus(paymentId: number): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.getPaymentStatus}/${paymentId}`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };
    return this.http.get<PaymentModel>(url, { headers });
  }

  /**
   * Get payment status from order (Helper method)
   */
  getOrderPaymentStatus(order: OrderModel): string {
    if (!order.payment) return 'Pending';
    
    const status = order.payment.status;
    return status.replace(/_/g, ' ')
                 .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Process refund
   */
  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.refundPayment}/${paymentId}/refund`;
    const payload = { amount, reason };
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };
    
    return this.http.post<PaymentModel>(url, payload, { headers }).pipe(
      tap(payment => {
        this.toastr.success('Refund processed successfully', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Refund processing failed', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Validate promotion code
   */
  validatePromotionCode(code: string, orderTotal: number): Observable<PromotionModel> {
    const promotion = this.mockPromotions.find(p => 
      p.code.toLowerCase() === code.toLowerCase().trim() && p.is_active
    );

    if (!promotion) {
      this.toastr.error('Invalid promotion code', 'Error');
      return throwError(() => ({ status: 404, message: 'Promotion code not found' }));
    }

    const currentDate = new Date().toISOString().split('T')[0];
    if (currentDate < promotion.start_date || currentDate > promotion.end_date) {
      this.toastr.error('This promotion is not currently active', 'Error');
      return throwError(() => ({ 
        status: 400, 
        message: 'This promotion is not currently active' 
      }));
    }

    if (promotion.minimum_order_amount && orderTotal < promotion.minimum_order_amount) {
      this.toastr.error(`Minimum order amount of $${promotion.minimum_order_amount} required`, 'Error');
      return throwError(() => ({ 
        status: 400, 
        message: `Minimum order amount of $${promotion.minimum_order_amount} required` 
      }));
    }

    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      this.toastr.error('This promotion has reached its usage limit', 'Error');
      return throwError(() => ({ 
        status: 400, 
        message: 'This promotion has reached its usage limit' 
      }));
    }

    this.toastr.success(`Promotion "${promotion.code}" applied!`, 'Success');
    return of(promotion);
  }

  /**
   * Get available promotions
   */
  getAvailablePromotions(): PromotionModel[] {
    return this.mockPromotions.filter(p => p.is_active);
  }

  /**
   * Use promotion (increment usage count)
   */
  usePromotion(code: string): void {
    const promotion = this.mockPromotions.find(p => 
      p.code.toLowerCase() === code.toLowerCase().trim()
    );
    
    if (promotion) {
      promotion.usage_count++;
      console.log(`Promotion ${code} used. New usage count: ${promotion.usage_count}`);
    }
  }

  /**
   * Calculate discount from promotion
   */
  calculateDiscount(promotion: PromotionModel, orderTotal: number): number {
    let discount = 0;
    
    if (promotion.discount_type === 'percentage') {
      discount = (orderTotal * promotion.discount_value) / 100;
      
      if (promotion.maximum_discount_amount && discount > promotion.maximum_discount_amount) {
        discount = promotion.maximum_discount_amount;
      }
    } else if (promotion.discount_type === 'fixed_amount') {
      discount = Math.min(promotion.discount_value, orderTotal);
    } else if (promotion.discount_type === 'free_shipping') {
      discount = 0; // Handled separately
    }
    
    return Math.round(discount * 100) / 100;
  }

  /**
   * Generate invoice for order
   */
  generateInvoice(orderId: number): Observable<InvoiceModel> {
    return of({
      id: Date.now(),
      order_id: orderId,
      invoice_number: `INV-${orderId}-${Date.now()}`,
      issue_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'sent' as any,
      subtotal: 0,
      tax_amount: 0,
      shipping_cost: 0,
      discount_amount: 0,
      total_amount: 0,
      currency: 'USD'
    }).pipe(
      delay(500),
      tap(() => {
        this.toastr.success('Invoice generated successfully', 'Success');
      })
    );
  }

  /**
   * Download invoice PDF
   */
  downloadInvoice(invoiceId: number): Observable<Blob> {
    const invoiceContent = `
      INVOICE #${invoiceId}
      Generated: ${new Date().toLocaleDateString()}
      
      Thank you for your order!
      
      For questions, please contact support.
    `;
    
    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    
    return of(blob).pipe(
      delay(300),
      tap(() => {
        this.toastr.success('Invoice download started', 'Success');
      })
    );
  }

  /**
   * Create return request
   */
  createReturnRequest(returnData: Partial<ReturnRequest>): Observable<ReturnRequest> {
    const url = `${this.apiUrl}/returns`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.post<ReturnRequest>(url, returnData, { headers }).pipe(
      tap(returnRequest => {
        this.toastr.success('Return request submitted successfully', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Failed to submit return request', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get return requests for user
   */
  getUserReturnRequests(): Observable<ReturnRequest[]> {
    const url = `${this.apiUrl}/returns/user`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.get<ReturnRequest[]>(url, { headers });
  }

  /**
   * Get order analytics for user
   */
  getUserOrderAnalytics(dateRange?: { from: string; to: string }): Observable<OrderAnalytics> {
    let params = new HttpParams();
    if (dateRange) {
      params = params.set('date_from', dateRange.from).set('date_to', dateRange.to);
    }
    
    const url = `${this.apiUrl}/orders/analytics/user`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.get<OrderAnalytics>(url, { params, headers });
  }

  /**
   * Get order tracking events
   */
  getOrderTrackingEvents(orderId: number): Observable<OrderTrackingEvent[]> {
    const url = `${this.apiUrl}/orders/${orderId}/tracking`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.get<OrderTrackingEvent[]>(url, { headers });
  }

  /**
   * Add tracking event
   */
  addTrackingEvent(orderId: number, event: Partial<OrderTrackingEvent>): Observable<OrderTrackingEvent> {
    const url = `${this.apiUrl}/orders/${orderId}/tracking`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    return this.http.post<OrderTrackingEvent>(url, event, { headers });
  }

  /**
   * Calculate order total including shipping and tax
   */
  calculateOrderTotal(
    cartSubtotal: number, 
    shippingCost: number, 
    taxRate: number = 0,
    discountAmount: number = 0
  ): number {
    const tax = cartSubtotal * taxRate;
    return Math.max(0, cartSubtotal + shippingCost + tax - discountAmount);
  }

  /**
   * Calculate subtotal from order items
   */
  private calculateSubtotal(items: { unit_price: number; quantity: number }[]): number {
    return items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  }

  /**
   * Calculate subtotal with pricing service validation
   */
  private calculateSubtotalWithPricing(items: { unit_price: number; quantity: number }[]): number {
    return this.calculateSubtotal(items);
  }

  /**
   * Set current order data for checkout process
   */
  setCurrentOrderData(orderData: Partial<CreateOrderRequest>): void {
    this.currentOrderSubject.next(orderData);
  }

  /**
   * Get current order data
   */
  getCurrentOrderData(): Partial<CreateOrderRequest> | null {
    return this.currentOrderSubject.value;
  }

  /**
   * Clear current order data
   */
  clearCurrentOrderData(): void {
    this.currentOrderSubject.next(null);
  }

  /**
   * Get order status display text
   */
  getOrderStatusText(status: OrderStatus): string {
    const statusMap: { [key in OrderStatus]: string } = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'processing': 'Processing',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'refunded': 'Refunded',
      'returned': 'Returned'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Get order status color class for UI
   */
  getOrderStatusColor(status: OrderStatus): string {
    const colorMap: { [key in OrderStatus]: string } = {
      'pending': 'warning',
      'confirmed': 'info',
      'processing': 'primary',
      'shipped': 'success',
      'delivered': 'success',
      'cancelled': 'danger',
      'refunded': 'secondary',
      'returned': 'secondary'
    };
    return colorMap[status] || 'secondary';
  }

  /**
   * Check if order can be cancelled
   */
  canCancelOrder(order: OrderModel): boolean {
    return ['pending', 'confirmed'].includes(order.status);
  }

  /**
   * Check if order can be returned
   */
  canReturnOrder(order: OrderModel): boolean {
    if (order.status !== 'delivered') return false;
    
    const deliveredDate = new Date(order.shipping_status?.actual_delivery_date || order.order_date);
    const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = new Date();
    
    return (now.getTime() - deliveredDate.getTime()) <= returnWindow;
  }

  /**
   * Check if order can be reordered
   */
  canReorderOrder(order: OrderModel): boolean {
    return ['delivered', 'cancelled'].includes(order.status);
  }

  /**
   * Format order date for display
   */
  formatOrderDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Format currency amount
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  /**
   * Get total number of items in order
   */
  getTotalItemsInOrder(order: OrderModel): number {
    return order.order_items?.reduce((total, item) => total + item.quantity, 0) || 0;
  }

  /**
   * Get order subtotal (before shipping and tax)
   */
  getOrderSubtotal(order: OrderModel): number {
    return order.order_items?.reduce((total, item) => total + item.total_price, 0) || 0;
  }

  /**
   * Get estimated delivery date
   */
  getEstimatedDeliveryDate(order: OrderModel): Date | null {
    if (!order.shipping_method) return null;
    
    const orderDate = new Date(order.order_date);
    const deliveryDays = parseInt(order.shipping_method.estimated_delivery_days) || 7;
    
    const estimatedDate = new Date(orderDate);
    estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
    
    return estimatedDate;
  }

  /**
   * Check if order has tracking information
   */
  hasTrackingInfo(order: OrderModel): boolean {
    return !!(order.shipping_status?.tracking_number);
  }

  /**
   * Get tracking URL
   */
  getTrackingUrl(order: OrderModel): string | null {
    if (!order.shipping_status?.tracking_number) return null;
    
    const trackingNumber = order.shipping_status.tracking_number;
    const carrier = order.shipping_method?.carrier?.toLowerCase();
    
    switch (carrier) {
      case 'ups':
        return `https://www.ups.com/track?tracknum=${trackingNumber}`;
      case 'fedex':
        return `https://www.fedex.com/fedextrack/?tracknumber=${trackingNumber}`;
      case 'usps':
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      case 'dhl':
        return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`;
      default:
        return `https://www.google.com/search?q=track+package+${trackingNumber}`;
    }
  }

  /**
   * Get product names from order
   */
  getProductNamesFromOrder(order: OrderModel): string {
    if (!order.order_items || order.order_items.length === 0) {
      return 'No items';
    }
    
    const names = order.order_items
      .map(item => item.product?.name || 'Unknown Product')
      .slice(0, 3);
    
    const result = names.join(', ');
    
    if (order.order_items.length > 3) {
      return result + ` and ${order.order_items.length - 3} more`;
    }
    
    return result;
  }

  /**
   * Get shipping method name
   */
  getShippingMethodName(order: OrderModel): string {
    return order.shipping_method?.name || 'Standard Shipping';
  }

  /**
   * Get payment method name
   */
  getPaymentMethodName(order: OrderModel): string {
    return order.payment?.payment_method || 'Not specified';
  }

  /**
   * Get shipping status
   */
  getShippingStatus(order: OrderModel): string {
    if (!order.shipping_status) return 'Pending';
    
    const status = order.shipping_status.status;
    return status.replace(/_/g, ' ')
                 .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Add order to cache
   */
  private addOrderToCache(order: OrderModel): void {
    const currentOrders = this.orderCacheSubject.value;
    const existingIndex = currentOrders.findIndex(o => o.id === order.id);
    
    if (existingIndex !== -1) {
      currentOrders[existingIndex] = order;
    } else {
      currentOrders.unshift(order);
    }
    
    this.orderCacheSubject.next([...currentOrders]);
  }

  /**
   * Update order in cache
   */
  private updateOrderInCache(order: OrderModel): void {
    const currentOrders = this.orderCacheSubject.value;
    const index = currentOrders.findIndex(o => o.id === order.id);
    
    if (index !== -1) {
      currentOrders[index] = order;
      this.orderCacheSubject.next([...currentOrders]);
    }
  }

  /**
   * Update order cache with multiple orders
   */
  private updateOrderCache(orders: OrderModel[]): void {
    this.orderCacheSubject.next(orders);
  }

  /**
   * Map order to summary
   */
  private mapOrderToSummary(order: OrderModel): OrderSummary {
    return {
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      order_date: order.order_date,
      item_count: order.order_items?.length || 0,
      shipping_method_name: order.shipping_method?.name
    };
  }

  /**
   * Get order items for a specific order with complete product data
   */
  getOrderItems(orderId: number): Observable<any[]> {
    const url = `${this.apiUrl}/order_items`;
    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    // Filter by order_id - you might need to adjust this based on your API
    return this.http.get<any[]>(url, { headers }).pipe(
      map(allItems => {
        // Filter items for the specific order
        return allItems.filter(item => item.order_id === orderId);
      }),
      tap(items => {
        console.log(`Loaded ${items.length} items for order ${orderId}:`, items);
      }),
      catchError(error => {
        console.error(`Error loading items for order ${orderId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get order details by combining order metadata with order items
   */
  getOrderWithItems(orderId: number): Observable<OrderModel> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User not authenticated'));
    }

    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    // Get both order and order items in parallel
    const order$ = this.http.get<OrderModel>(`${this.apiUrl}/${environment.apiEndpoints.order.getOrder}/${orderId}`, { headers });
    const orderItems$ = this.getOrderItems(orderId);

    return forkJoin({
      order: order$,
      orderItems: orderItems$
    }).pipe(
      map(({ order, orderItems }) => {
        // Security check
        if (order.user_id !== userId) {
          throw new Error('Access denied: Order does not belong to current user');
        }

        // Combine order with items
        const completeOrder: OrderModel = {
          ...order,
          order_items: orderItems
        };

        console.log('Complete order with items from order_items table:', completeOrder);
        return completeOrder;
      }),
      tap(order => {
        this.addOrderToCache(order);
      }),
      catchError(error => {
        console.error('Error loading order with items:', error);
        if (error.message?.includes('Access denied')) {
          this.toastr.error('You can only view your own orders', 'Access Denied');
        } else {
          this.toastr.error('Failed to load order details', 'Error');
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user orders with order items - Primary approach using order_items table
   */
  getUserOrdersWithItems(
    page: number = 1,
    perPage: number = 10,
    filters?: OrderFilterOptions
  ): Observable<OrderResponse> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User not authenticated'));
    }

    const headers = {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };

    // Get all order items and all orders in parallel
    const orders$ = this.http.get<OrderModel[]>(`${this.apiUrl}/${environment.apiEndpoints.order.getUserOrders}`, { headers });
    const orderItems$ = this.http.get<any[]>(`${this.apiUrl}/order_items`, { headers });

    return forkJoin({
      orders: orders$,
      orderItems: orderItems$
    }).pipe(
      map(({ orders, orderItems }) => {
        console.log('Raw orders:', orders.length);
        console.log('Raw order items:', orderItems.length);

        // Filter orders for current user
        let userOrders = orders.filter(order => order.user_id === userId);

        // Apply filters to orders
        if (filters?.status) {
          userOrders = userOrders.filter(order => order.status === filters.status);
        }
        if (filters?.date_from) {
          userOrders = userOrders.filter(order => 
            new Date(order.order_date) >= new Date(filters.date_from!)
          );
        }
        if (filters?.date_to) {
          userOrders = userOrders.filter(order => 
            new Date(order.order_date) <= new Date(filters.date_to!)
          );
        }
        if (filters?.min_amount) {
          userOrders = userOrders.filter(order => order.total_amount >= filters.min_amount!);
        }
        if (filters?.max_amount) {
          userOrders = userOrders.filter(order => order.total_amount <= filters.max_amount!);
        }
        if (filters?.search_term) {
          const searchTerm = filters.search_term.toLowerCase();
          userOrders = userOrders.filter(order => 
            order.id.toString().includes(searchTerm) ||
            order.notes.toLowerCase().includes(searchTerm)
          );
        }

        // Attach order items to each order
        const ordersWithItems = userOrders.map(order => {
          const itemsForOrder = orderItems.filter(item => item.order_id === order.id);
          return {
            ...order,
            order_items: itemsForOrder
          };
        });

        // Sort by date (newest first)
        ordersWithItems.sort((a, b) => 
          new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
        );

        // Calculate pagination
        const totalItems = ordersWithItems.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const startIndex = (page - 1) * perPage;
        const paginatedOrders = ordersWithItems.slice(startIndex, startIndex + perPage);

        console.log(`Returning ${paginatedOrders.length} orders with items for page ${page}`);

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
      }),
      tap(response => {
        console.log(`Loaded ${response.items.length} orders with items for page ${page}`);
        
        // Update cache with new orders
        this.updateOrderCache(response.items);
        
        // Update order summary
        const summaries = response.items.map(order => this.mapOrderToSummary(order));
        this.orderSummarySubject.next(summaries);
      }),
      catchError(error => {
        console.error('Error loading orders with items:', error);
        this.toastr.error('Failed to load orders', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.orderCacheSubject.next([]);
    this.orderSummarySubject.next([]);
    this.currentOrderSubject.next(null);
    this.loadedOrderItems.clear();
    this.orderItemsLoading.clear();
  }
}