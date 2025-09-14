// services/order.service.ts - UPDATED FOR DEVELOPMENT MODE
import { Injectable } from '@angular/core';
import { Observable, combineLatest, BehaviorSubject, of } from 'rxjs';
import { map, tap, shareReplay, switchMap } from 'rxjs/operators';
import { OrderCoreService } from './order-core.service';
import { OrderCacheService } from './order-cache.service';
import { OrderValidationService } from './order-validation.service';
import { OrderPaymentService } from './order-payment.service';
import { OrderAnalyticsService } from './order-analytics.service';
import { OrderUtilityService } from './order-utility.service';
import { OrderBusinessLogicService } from './order-business-logic.service';
import { ShippingService } from './shipping.service';
import { ShippingIntegrationService } from './shipping-integration.service';
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderResponse,
  UpdateOrderRequest,
  PaymentRequest,
  PaymentModel,
  OrderFilterOptions,
  PromotionModel,
  OrderSummary
} from '../models/order.model';

/**
 * Main Order Service - Updated for Development Mode
 * This service acts as a facade that delegates to specialized services
 */
@Injectable({
  providedIn: 'root'
})
export class OrderService {

  // Current order state for checkout process
  private currentOrderSubject = new BehaviorSubject<Partial<CreateOrderRequest> | null>(null);
  currentOrder$ = this.currentOrderSubject.asObservable();

  // Current filters state
  private currentFiltersSubject = new BehaviorSubject<OrderFilterOptions>({});
  currentFilters$ = this.currentFiltersSubject.asObservable();

  // Loading state
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  // Combined observable for dashboard data - initialized after dependency injection
  dashboard$: Observable<any>;

  constructor(
    private orderCore: OrderCoreService,
    private orderCache: OrderCacheService,
    private validation: OrderValidationService,
    private payment: OrderPaymentService,
    private analytics: OrderAnalyticsService,
    private utility: OrderUtilityService,
    private businessLogic: OrderBusinessLogicService, // Use business logic service for dev payments
    private shipping: ShippingService,
    private shippingIntegration: ShippingIntegrationService
  ) {
    // Initialize dashboard observable after dependencies are injected
    this.dashboard$ = combineLatest([
      this.orderCache.orders$,
      this.analytics.getOrderStatistics(),
      this.analytics.getDashboardSummary()
    ]).pipe(
      map(([orders, statistics, summary]) => ({
        orders: orders.slice(0, 5), // Latest 5 orders
        statistics,
        summary
      })),
      shareReplay(1)
    );
  }

  // ===== PRIMARY ORDER OPERATIONS =====

  /**
   * Create order with integrated shipping and payment validation
   */
  createOrder(orderData: CreateOrderRequest): Observable<OrderModel> {
    this.setLoading(true);

    // Integrate with shipping service
    const selectedShippingMethod = this.shippingIntegration.getSelectedShippingMethod();
    if (selectedShippingMethod && !orderData.shipping_method_id) {
      orderData.shipping_method_id = selectedShippingMethod;
    }

    return this.businessLogic.createOrder(orderData).pipe(
      tap(order => {
        this.clearCurrentOrder();
        this.shippingIntegration.reset();
      }),
      tap(() => this.setLoading(false))
    );
  }

  /**
   * Get orders with smart caching and filtering
   */
  getOrders(
    page: number = 1,
    perPage: number = 10,
    filters?: OrderFilterOptions
  ): Observable<OrderResponse> {
    if (filters) {
      this.setCurrentFilters(filters);
    }

    return this.orderCore.getOrders(page, perPage, filters);
  }

  /**
   * Get single order with cache-first strategy
   */
  getOrder(orderId: number): Observable<OrderModel> {
    return this.orderCore.getOrder(orderId);
  }

  /**
   * Update order with validation
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    return this.orderCore.updateOrder(orderId, updates);
  }

  /**
   * Cancel order with validation
   */
  cancelOrder(orderId: number, reason?: string): Observable<OrderModel> {
    return this.businessLogic.cancelOrder(orderId, reason);
  }

  // ===== DEVELOPMENT MODE PAYMENT OPERATIONS =====

  /**
   * Process payment - Uses development mode mock payment
   */
  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    return this.businessLogic.processPayment(paymentData);
  }

  /**
   * Get payment status (mock in development)
   */
  getPaymentStatus(paymentId: number): Observable<PaymentModel> {
    // In development mode, return a mock payment status
    const mockPayment: PaymentModel = {
      id: paymentId,
      created_at: Date.now(),
      amount: 100, // Mock amount
      payment_method: 'credit_card',
      status: 'completed',
      order_id: 1,
      transaction_id: `DEV_TXN_${paymentId}`,
      currency: 'USD'
    };

    return of(mockPayment);
  }

  /**
   * Process refund (mock in development)
   */
  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    return this.businessLogic.processRefund(paymentId, amount, reason);
  }

  // ===== PROMOTION OPERATIONS =====

  validatePromotionCode(code: string, orderTotal: number): Observable<PromotionModel> {
    return this.businessLogic.validatePromotionCode(code, orderTotal);
  }

  getAvailablePromotions(): Observable<PromotionModel[]> {
    return of(this.businessLogic.getAvailablePromotions());
  }

  calculateDiscount(promotion: PromotionModel, orderTotal: number): number {
    return this.businessLogic.calculateDiscount(promotion, orderTotal);
  }

  usePromotion(code: string): Observable<void> {
    this.businessLogic.usePromotion(code);
    return of(void 0);
  }

  // ===== SHIPPING INTEGRATION =====

  getShippingMethods(forceRefresh: boolean = false): Observable<any[]> {
    return this.shipping.getShippingMethods(forceRefresh);
  }

  getUserShippingAddresses(forceRefresh: boolean = false): Observable<any[]> {
    return this.shipping.getUserShippingAddresses(forceRefresh);
  }

  createShippingAddress(address: any): Observable<any> {
    return this.shipping.createShippingAddress(address);
  }

  updateShippingAddress(addressId: number, address: any): Observable<any> {
    return this.shipping.updateShippingAddress(addressId, address);
  }

  deleteShippingAddress(addressId: number): Observable<void> {
    return this.shipping.deleteShippingAddress(addressId);
  }

  calculateShippingCost(methodId: number, cartTotal: number, shippingMethods?: any[]): number {
    return this.shipping.calculateShippingCost(methodId, cartTotal, shippingMethods);
  }

  selectShippingMethod(methodId: number): void {
    this.shippingIntegration.selectShippingMethod(methodId);
  }

  getSelectedShippingMethod(): number | null {
    return this.shippingIntegration.getSelectedShippingMethod();
  }

  updateCartTotal(total: number): void {
    this.shipping.updateCartTotal(total);
  }

  // ===== CURRENT ORDER STATE MANAGEMENT =====

  setCurrentOrder(orderData: Partial<CreateOrderRequest>): void {
    this.currentOrderSubject.next(orderData);
  }

  getCurrentOrder(): Partial<CreateOrderRequest> | null {
    return this.currentOrderSubject.value;
  }

  updateCurrentOrder(updates: Partial<CreateOrderRequest>): void {
    const current = this.currentOrderSubject.value;
    this.currentOrderSubject.next({ ...current, ...updates });
  }

  clearCurrentOrder(): void {
    this.currentOrderSubject.next(null);
  }

  // ===== FILTER MANAGEMENT =====

  setCurrentFilters(filters: OrderFilterOptions): void {
    this.currentFiltersSubject.next(filters);
  }

  getCurrentFilters(): OrderFilterOptions {
    return this.currentFiltersSubject.value;
  }

  clearFilters(): void {
    this.currentFiltersSubject.next({});
  }

  // ===== CACHE OPERATIONS =====

  /**
   * Get cached orders (reactive)
   */
  getCachedOrders(): Observable<OrderModel[]> {
    return this.orderCache.orders$;
  }

  /**
   * Search orders in cache
   */
  searchOrders(searchTerm: string): Observable<OrderModel[]> {
    return this.orderCache.orders$.pipe(
      map(orders => this.orderCache.searchOrders(searchTerm))
    );
  }

  /**
   * Refresh all order data
   */
  refreshOrders(): void {
    this.orderCore.refreshOrders();
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.orderCache.clear();
    this.shipping.clearCache();
  }

  // ===== ANALYTICS AND REPORTING =====

  /**
   * Get order analytics
   */
  getOrderAnalytics(): Observable<any> {
    return this.analytics.getOrderAnalytics();
  }

  /**
   * Get order statistics
   */
  getOrderStatistics(): Observable<any> {
    return this.analytics.getOrderStatistics();
  }

  /**
   * Get revenue trends
   */
  getRevenueTrends(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Observable<any[]> {
    return this.analytics.getRevenueTrends(period);
  }

  /**
   * Get top products
   */
  getTopProducts(limit: number = 10): Observable<any[]> {
    return this.analytics.getTopProducts(limit);
  }

  /**
   * Export analytics data
   */
  exportAnalyticsData(): Observable<any> {
    return this.analytics.exportAnalyticsData();
  }

  // ===== VALIDATION UTILITIES =====

  /**
   * Validate order creation request
   */
  validateOrderCreation(orderData: CreateOrderRequest): { isValid: boolean; errors: string[]; warnings?: string[] } {
    return this.validation.validateCreateOrderRequest(orderData);
  }

  /**
   * Check if order can be cancelled
   */
  canCancelOrder(order: OrderModel): boolean {
    return this.businessLogic.canCancelOrder(order);
  }

  /**
   * Check if order can be returned
   */
  canReturnOrder(order: OrderModel): boolean {
    return this.businessLogic.canReturnOrder(order);
  }

  /**
   * Quick validation for operations
   */
  quickValidate(order: OrderModel, operation: 'view' | 'cancel' | 'return' | 'modify'): boolean {
    return this.validation.quickValidate(order, operation);
  }

  // ===== UTILITY METHODS =====

  formatCurrency(amount: number): string {
    return this.utility.formatCurrency(amount);
  }

  formatOrderDate(dateString: string): string {
    return this.utility.formatOrderDate(dateString);
  }

  formatOrderId(orderId: number): string {
    return this.utility.formatOrderId(orderId);
  }

  getOrderStatusText(status: any): string {
    return this.utility.getOrderStatusText(status);
  }

  getOrderStatusColor(status: any): string {
    return this.utility.getOrderStatusColor(status);
  }

  getOrderStatusIcon(status: any): string {
    return this.utility.getOrderStatusIcon(status);
  }

  getTotalItemsInOrder(order: OrderModel): number {
    return this.utility.getTotalItemsInOrder(order);
  }

  getOrderSubtotal(order: OrderModel): number {
    return this.utility.getOrderSubtotal(order);
  }

  getEstimatedDeliveryDate(order: OrderModel): Date | null {
    return this.businessLogic.getEstimatedDeliveryDate(order);
  }

  hasTrackingInfo(order: OrderModel): boolean {
    return this.utility.hasTrackingInfo(order);
  }

  getTrackingUrl(order: OrderModel): string | null {
    return this.utility.getTrackingUrl(order);
  }

  getProductNamesFromOrder(order: OrderModel): string {
    return this.utility.getProductNamesFromOrder(order);
  }

  getCustomerName(order: OrderModel): string {
    return this.utility.getCustomerName(order);
  }

  // ===== BULK OPERATIONS =====

  /**
   * Export orders to CSV
   */
  exportOrdersToCSV(orders: OrderModel[], filename?: string): void {
    this.utility.downloadCSV(orders, filename);
  }

  /**
   * Get orders by status from cache
   */
  getOrdersByStatus(status: string): Observable<OrderModel[]> {
    return this.orderCache.orders$.pipe(
      map(orders => orders.filter(order => order.status === status))
    );
  }

  /**
   * Get orders by date range from cache
   */
  getOrdersByDateRange(startDate: Date, endDate: Date): Observable<OrderModel[]> {
    return this.orderCache.orders$.pipe(
      map(orders => this.orderCache.getOrdersByDateRange(startDate, endDate))
    );
  }

  // ===== CALCULATION METHODS =====

  /**
   * Calculate order total with promotions
   */
  calculateOrderTotal(
    subtotal: number,
    shippingCost: number,
    taxRate: number = 0,
    promotion?: PromotionModel | null
  ): any {
    return this.businessLogic.calculateOrderTotal(subtotal, shippingCost, taxRate, promotion);
  }

  /**
   * Calculate subtotal from items
   */
  calculateSubtotal(items: Array<{ unit_price: number; quantity: number }>): number {
    return this.businessLogic.calculateSubtotal(items);
  }

  // ===== LOADING STATE MANAGEMENT =====

  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  isLoading(): Observable<boolean> {
    return this.loading$;
  }

  // ===== REORDER FUNCTIONALITY =====

  /**
   * Get items from previous order for reordering
   */
  getReorderItems(orderId: number): Observable<any[]> {
    return this.getOrder(orderId).pipe(
      map(order => {
        if (!order.order_items || order.order_items.length === 0) {
          throw new Error('No items found in this order');
        }
        
        return order.order_items.map(item => ({
          product_id: item.product_id,
          product_variant_id: item.product_variant_id,
          quantity: item.quantity,
          product_name: item.product?.name || 'Unknown Product',
          current_price: item.unit_price,
          image_url: item.product?.main_image_url || '',
          brand: item.product?.brand || '',
          in_stock: true // Would need actual inventory check
        }));
      })
    );
  }

  // ===== INVOICE OPERATIONS =====

  /**
   * Generate invoice for an order
   */
  generateInvoice(orderId: number): Observable<any> {
    return this.businessLogic.generateInvoice(orderId);
  }

  /**
   * Download invoice for an order
   */
  downloadInvoice(orderId: number): Observable<Blob> {
    return this.businessLogic.downloadInvoice(orderId);
  }

  // ===== RETURN OPERATIONS =====

  /**
   * Create return request
   */
  createReturnRequest(returnData: any): Observable<any> {
    return this.businessLogic.createReturnRequest(returnData);
  }

  // ===== SERVICE INTEGRATION STATUS =====

  /**
   * Get integration status of all services
   */
  getIntegrationStatus(): {
    core: boolean;
    cache: boolean;
    validation: boolean;
    payment: boolean;
    analytics: boolean;
    businessLogic: boolean;
    shipping: boolean;
    shippingIntegration: boolean;
  } {
    return {
      core: !!this.orderCore,
      cache: !!this.orderCache,
      validation: !!this.validation,
      payment: !!this.payment,
      analytics: !!this.analytics,
      businessLogic: !!this.businessLogic,
      shipping: !!this.shipping,
      shippingIntegration: this.shippingIntegration.isInitialized()
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cacheStats: any;
    paymentCacheStats: any;
    totalMemoryUsage: string;
  } {
    const cacheStats = this.orderCache.getCacheStats();
    const paymentCacheStats = this.payment.getCacheStats();

    return {
      cacheStats,
      paymentCacheStats,
      totalMemoryUsage: `${Math.round((JSON.stringify(cacheStats).length + JSON.stringify(paymentCacheStats).length) / 1024)}KB`
    };
  }

  // ===== DEBUG AND MONITORING =====

  /**
   * Debug all service states
   */
  debugAllServices(): void {
    console.group('[OrderService] Complete Debug Information');
    
    console.log('Integration Status:', this.getIntegrationStatus());
    console.log('Performance Stats:', this.getPerformanceStats());
    console.log('Current Order:', this.getCurrentOrder());
    console.log('Current Filters:', this.getCurrentFilters());
    
    this.orderCache.debugCache();
    this.payment.debugPaymentService();
    
    console.groupEnd();
  }

  /**
   * Get service version and info
   */
  getServiceInfo(): {
    version: string;
    components: string[];
    isFullyInitialized: boolean;
    lastRefresh: number;
    developmentMode: boolean;
  } {
    const integrationStatus = this.getIntegrationStatus();
    const isFullyInitialized = Object.values(integrationStatus).every(status => status === true);

    return {
      version: '3.0.0-development',
      components: [
        'OrderCoreService',
        'OrderCacheService', 
        'OrderValidationService',
        'OrderPaymentService',
        'OrderAnalyticsService',
        'OrderUtilityService',
        'OrderBusinessLogicService',
        'ShippingService',
        'ShippingIntegrationService'
      ],
      isFullyInitialized,
      lastRefresh: Date.now(),
      developmentMode: true
    };
  }

  // ===== CLEANUP METHODS =====

  /**
   * Reset all services to initial state
   */
  resetAllServices(): void {
    this.clearCurrentOrder();
    this.clearFilters();
    this.clearCache();
    this.shippingIntegration.reset();
    this.payment.clearPromotionsCache();
  }

  /**
   * Optimize performance by cleaning up old data
   */
  optimizePerformance(): void {
    // Clean up expired cache entries
    this.orderCache.clear();
    
    // Clear old promotion cache
    this.payment.clearPromotionsCache();
    
    // Reset shipping calculations
    this.shippingIntegration.refreshShippingCalculations();
  }

  /**
   * Development mode specific methods
   */
  getDevelopmentInfo(): {
    mockPaymentsEnabled: boolean;
    mockPromotionsCount: number;
    lastOrderCreated: string;
  } {
    return {
      mockPaymentsEnabled: true,
      mockPromotionsCount: this.businessLogic.getAvailablePromotions().length,
      lastOrderCreated: new Date().toISOString()
    };
  }
}