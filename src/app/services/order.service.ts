import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
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
  PromotionModel
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

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {
    this.apiUrl = environment.apiBaseUrl;
  }

  /**
   * Create a new order with all related data
   */
  createOrder(orderData: CreateOrderRequest): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.createOrder}`;
    
    // Calculate totals
    const subtotal = this.calculateSubtotal(orderData.items);
    const orderPayload = {
      ...orderData,
      total_amount: subtotal, // Will be updated with shipping and tax on backend
      status: 'pending' as OrderStatus,
      order_date: new Date().toISOString(),
      order_items: orderData.items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      }))
    };

    return this.http.post<OrderModel>(url, orderPayload).pipe(
      tap(order => {
        // Clear current order after successful creation
        this.currentOrderSubject.next(null);
        
        // Update cache
        this.addOrderToCache(order);
        
        this.toastr.success('Order placed successfully!', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Failed to create order. Please try again.', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get user's orders with pagination and filtering
   */
  getUserOrders(
    page: number = 1,
    perPage: number = 10,
    filters?: OrderFilterOptions
  ): Observable<OrderResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('perPage', perPage.toString());

    // Add filters
    if (filters) {
      if (filters.status) params = params.set('status', filters.status);
      if (filters.date_from) params = params.set('date_from', filters.date_from);
      if (filters.date_to) params = params.set('date_to', filters.date_to);
      if (filters.min_amount) params = params.set('min_amount', filters.min_amount.toString());
      if (filters.max_amount) params = params.set('max_amount', filters.max_amount.toString());
      if (filters.shipping_method_id) params = params.set('shipping_method_id', filters.shipping_method_id.toString());
      if (filters.search_term) params = params.set('search', filters.search_term);
    }
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getUserOrders}`;
    return this.http.get<OrderResponse>(url, { params }).pipe(
      tap(response => {
        // Update cache with new orders
        this.updateOrderCache(response.items);
        
        // Update order summary
        const summaries = response.items.map(this.mapOrderToSummary);
        this.orderSummarySubject.next(summaries);
      }),
      catchError(error => {
        this.toastr.error('Failed to load orders', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get specific order by ID with all related data
   */
  getOrder(orderId: number): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getOrder}/${orderId}`;
    return this.http.get<OrderModel>(url).pipe(
      tap(order => {
        this.addOrderToCache(order);
      }),
      catchError(error => {
        this.toastr.error('Failed to load order details', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Update order status and other details
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.updateOrderStatus}/${orderId}`;
    return this.http.patch<OrderModel>(url, updates).pipe(
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
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.cancelOrder}/${orderId}`;
    const payload = { 
      status: 'cancelled' as OrderStatus,
      notes: reason 
    };
    
    return this.http.patch<OrderModel>(url, payload).pipe(
      tap(cancelledOrder => {
        this.updateOrderInCache(cancelledOrder);
        this.toastr.success('Order cancelled successfully', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Failed to cancel order', 'Error');
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
    return this.http.post<PaymentModel>(url, paymentData).pipe(
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
   * Get payment status
   */
  getPaymentStatus(paymentId: number): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.getPaymentStatus}/${paymentId}`;
    return this.http.get<PaymentModel>(url);
  }

  /**
   * Process refund
   */
  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.refundPayment}/${paymentId}`;
    const payload = { amount, reason };
    
    return this.http.post<PaymentModel>(url, payload).pipe(
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
    const url = `${this.apiUrl}/promotions/validate`;
    return this.http.post<PromotionModel>(url, { code, order_total: orderTotal }).pipe(
      tap(promotion => {
        this.toastr.success(`Promotion "${promotion.code}" applied!`, 'Success');
      }),
      catchError(error => {
        if (error.status === 404) {
          this.toastr.error('Invalid promotion code', 'Error');
        } else if (error.status === 400) {
          this.toastr.error('Promotion code is not applicable to this order', 'Error');
        } else {
          this.toastr.error('Failed to validate promotion code', 'Error');
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Calculate discount amount
   */
  calculateDiscount(promotion: PromotionModel, orderTotal: number): number {
    if (promotion.discount_type === 'percentage') {
      const discount = (orderTotal * promotion.discount_value) / 100;
      return promotion.maximum_discount_amount 
        ? Math.min(discount, promotion.maximum_discount_amount)
        : discount;
    } else if (promotion.discount_type === 'fixed_amount') {
      return Math.min(promotion.discount_value, orderTotal);
    } else if (promotion.discount_type === 'free_shipping') {
      return 0; // Shipping cost will be set to 0 separately
    }
    return 0;
  }

  /**
   * Generate invoice for order
   */
  generateInvoice(orderId: number): Observable<InvoiceModel> {
    const url = `${this.apiUrl}/invoices/generate/${orderId}`;
    return this.http.post<InvoiceModel>(url, {}).pipe(
      tap(invoice => {
        this.toastr.success('Invoice generated successfully', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Failed to generate invoice', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Download invoice PDF
   */
  downloadInvoice(invoiceId: number): Observable<Blob> {
    const url = `${this.apiUrl}/invoices/download/${invoiceId}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      tap(() => {
        this.toastr.success('Invoice download started', 'Success');
      }),
      catchError(error => {
        this.toastr.error('Failed to download invoice', 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Create return request
   */
  createReturnRequest(returnData: Partial<ReturnRequest>): Observable<ReturnRequest> {
    const url = `${this.apiUrl}/returns`;
    return this.http.post<ReturnRequest>(url, returnData).pipe(
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
    return this.http.get<ReturnRequest[]>(url);
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
    return this.http.get<OrderAnalytics>(url, { params });
  }

  /**
   * Get order tracking events
   */
  getOrderTrackingEvents(orderId: number): Observable<OrderTrackingEvent[]> {
    const url = `${this.apiUrl}/orders/${orderId}/tracking`;
    return this.http.get<OrderTrackingEvent[]>(url);
  }

  /**
   * Add tracking event
   */
  addTrackingEvent(orderId: number, event: Partial<OrderTrackingEvent>): Observable<OrderTrackingEvent> {
    const url = `${this.apiUrl}/orders/${orderId}/tracking`;
    return this.http.post<OrderTrackingEvent>(url, event);
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
    return items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
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
    return statusMap[status] || status;
  }

  /**
   * Get order status color class for UI
   */
  getOrderStatusColor(status: OrderStatus): string {
    const colorMap: { [key in OrderStatus]: string } = {
      'pending': 'text-warning',
      'confirmed': 'text-info',
      'processing': 'text-primary',
      'shipped': 'text-success',
      'delivered': 'text-success',
      'cancelled': 'text-danger',
      'refunded': 'text-secondary',
      'returned': 'text-secondary'
    };
    return colorMap[status] || 'text-muted';
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
    
    // Check if within return window (e.g., 30 days)
    const deliveredDate = new Date(order.shipping_status?.actual_delivery_date || order.order_date);
    const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
   * Add order to cache
   */
  private addOrderToCache(order: OrderModel): void {
    const currentOrders = this.orderCacheSubject.value;
    const existingIndex = currentOrders.findIndex(o => o.id === order.id);
    
    if (existingIndex !== -1) {
      currentOrders[existingIndex] = order;
    } else {
      currentOrders.unshift(order); // Add to beginning for latest first
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
   * Clear all caches
   */
  clearCache(): void {
    this.orderCacheSubject.next([]);
    this.orderSummarySubject.next([]);
    this.currentOrderSubject.next(null);
  }
}