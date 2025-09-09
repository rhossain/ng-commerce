// services/order.service.ts - COMPLETE MAIN ORDER SERVICE
import { Injectable } from '@angular/core';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { map, switchMap, tap, catchError, finalize, delay } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { OrderRepositoryService } from './order-repository.service';
import { OrderBusinessLogicService } from './order-business-logic.service';
import { OrderStateManagementService } from './order-state-management.service';
import { OrderUtilityService } from './order-utility.service';
import { ShippingService } from './shipping.service'; // Your existing shipping service
import { ShippingIntegrationService } from './shipping-integration.service'; // Your existing integration service
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderResponse,
  UpdateOrderRequest,
  PaymentRequest,
  PaymentModel,
  OrderFilterOptions,
  PromotionModel,
  ReturnRequest,
  InvoiceModel,
  OrderAnalytics,
  OrderTrackingEvent
} from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  constructor(
    private orderRepository: OrderRepositoryService,
    private orderBusinessLogic: OrderBusinessLogicService,
    private orderStateManager: OrderStateManagementService,
    private orderUtility: OrderUtilityService,
    private authService: AuthService,
    private router: Router,
    private shippingService: ShippingService, // Your existing shipping service
    private shippingIntegration: ShippingIntegrationService // Your existing integration service
  ) {}

  // ===== OBSERVABLE ACCESSORS FOR STATE =====
  get currentOrder$() { return this.orderStateManager.currentOrder$; }
  get orderCache$() { return this.orderStateManager.orderCache$; }
  get orderSummary$() { return this.orderStateManager.orderSummary$; }
  get loadingStates$() { return this.orderStateManager.loadingStates$; }
  get filters$() { return this.orderStateManager.filters$; }
  get pagination$() { return this.orderStateManager.pagination$; }
  get selectedOrders$() { return this.orderStateManager.selectedOrders$; }
  get orderStats$() { return this.orderStateManager.orderStats$; }

  // ===== INTEGRATION WITH YOUR EXISTING SHIPPING SERVICES =====
  
  /**
   * Get shipping methods using your existing service
   */
  getShippingMethods(forceRefresh: boolean = false): Observable<any[]> {
    return this.shippingService.getShippingMethods(forceRefresh);
  }

  /**
   * Get user addresses using your existing service
   */
  getUserShippingAddresses(forceRefresh: boolean = false): Observable<any[]> {
    return this.shippingService.getUserShippingAddresses(forceRefresh);
  }

  /**
   * Create shipping address using your existing service
   */
  createShippingAddress(address: any): Observable<any> {
    return this.shippingService.createShippingAddress(address);
  }

  /**
   * Update shipping address using your existing service
   */
  updateShippingAddress(addressId: number, address: any): Observable<any> {
    return this.shippingService.updateShippingAddress(addressId, address);
  }

  /**
   * Delete shipping address using your existing service
   */
  deleteShippingAddress(addressId: number): Observable<void> {
    return this.shippingService.deleteShippingAddress(addressId);
  }

  /**
   * Set default shipping address using your existing service
   */
  setDefaultAddress(addressId: number): Observable<any> {
    return this.shippingService.setDefaultAddress(addressId);
  }

  /**
   * Calculate shipping cost using your existing service
   */
  calculateShippingCost(methodId: number, cartTotal: number, shippingMethods?: any[]): number {
    return this.shippingService.calculateShippingCost(methodId, cartTotal, shippingMethods);
  }

  /**
   * Get checkout summary with shipping integration
   */
  getCheckoutSummary(): Observable<any> {
    return this.shippingIntegration.checkoutSummary$;
  }

  /**
   * Select shipping method using your existing integration
   */
  selectShippingMethod(methodId: number): void {
    this.shippingIntegration.selectShippingMethod(methodId);
  }

  /**
   * Get selected shipping method from your integration service
   */
  getSelectedShippingMethod(): number | null {
    return this.shippingIntegration.getSelectedShippingMethod();
  }

  /**
   * Update cart total in shipping service
   */
  updateCartTotal(total: number): void {
    this.shippingService.updateCartTotal(total);
  }

  // ===== PRIMARY ORDER OPERATIONS =====

  /**
   * Create order with shipping integration
   */
  createOrder(orderData: CreateOrderRequest): Observable<OrderModel> {
    // Get selected shipping method from your integration service
    const selectedMethod = this.shippingIntegration.getSelectedShippingMethod();
    
    if (selectedMethod && !orderData.shipping_method_id) {
      orderData.shipping_method_id = selectedMethod;
    }

    return this.orderBusinessLogic.createOrder(orderData).pipe(
      tap(order => {
        this.orderStateManager.addOrderToCache(order);
        this.orderStateManager.clearCurrentOrderData();
        
        // Reset shipping integration after successful order
        this.shippingIntegration.reset();
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
      return throwError(() => new Error('User not authenticated'));
    }

    this.orderStateManager.setGlobalLoading(true);
    
    if (filters) {
      this.orderStateManager.setFilters(filters);
    }

    return this.orderRepository.getUserOrdersWithRelations(userId).pipe(
      map(allOrders => {
        let filteredOrders = this.applyFilters(allOrders, filters);
        filteredOrders = this.orderUtility.sortOrdersByDate(filteredOrders);
        
        const totalItems = filteredOrders.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const startIndex = (page - 1) * perPage;
        const paginatedOrders = filteredOrders.slice(startIndex, startIndex + perPage);
        
        this.orderStateManager.setPagination(page, perPage, totalPages);
        
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
        this.orderStateManager.updateOrderCache(response.items);
      }),
      catchError(error => {
        console.error('Error loading orders:', error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.orderStateManager.setGlobalLoading(false);
      })
    );
  }

  /**
   * Get specific order by ID with all related data
   */
  getOrder(orderId: number): Observable<OrderModel> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User not authenticated'));
    }

    const cachedOrder = this.orderStateManager.getOrderFromCache(orderId);
    if (cachedOrder && cachedOrder.order_items && cachedOrder.order_items.length > 0) {
      return of(cachedOrder);
    }

    this.orderStateManager.setOrderLoading(orderId, true);

    return this.orderRepository.getOrderWithRelations(orderId).pipe(
      map(order => {
        if (order.user_id !== userId) {
          throw new Error('Access denied: Order does not belong to current user');
        }
        return order;
      }),
      tap(order => {
        this.orderStateManager.addOrderToCache(order);
        this.orderStateManager.markOrderItemsAsLoaded(orderId);
      }),
      catchError(error => {
        console.error('Error loading order details:', error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.orderStateManager.setOrderLoading(orderId, false);
      })
    );
  }

  /**
   * Update order status and other details
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    return this.orderRepository.updateOrder(orderId, updates).pipe(
      tap(updatedOrder => {
        this.orderStateManager.updateOrderInCache(updatedOrder);
      })
    );
  }

  /**
   * Cancel order
   */
  cancelOrder(orderId: number, reason?: string): Observable<OrderModel> {
    return this.orderBusinessLogic.cancelOrder(orderId, reason).pipe(
      tap(cancelledOrder => {
        this.orderStateManager.updateOrderInCache(cancelledOrder);
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
      })
    );
  }

  // ===== PAYMENT OPERATIONS =====

  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    return this.orderBusinessLogic.processPayment(paymentData);
  }

  getPaymentStatus(paymentId: number): Observable<PaymentModel> {
    return this.orderRepository.getPaymentById(paymentId);
  }

  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    return this.orderBusinessLogic.processRefund(paymentId, amount, reason);
  }

  // ===== PROMOTION OPERATIONS =====

  validatePromotionCode(code: string, orderTotal: number): Observable<PromotionModel> {
    return this.orderBusinessLogic.validatePromotionCode(code, orderTotal);
  }

  getAvailablePromotions(): PromotionModel[] {
    return this.orderBusinessLogic.getAvailablePromotions();
  }

  calculateDiscount(promotion: PromotionModel, orderTotal: number): number {
    return this.orderBusinessLogic.calculateDiscount(promotion, orderTotal);
  }

  usePromotion(code: string): void {
    this.orderBusinessLogic.usePromotion(code);
  }

  // ===== ORDER ITEMS MANAGEMENT =====

  loadOrderItems(orderId: number): void {
    if (this.orderStateManager.areOrderItemsLoaded(orderId) || 
        this.orderStateManager.areOrderItemsLoading(orderId)) {
      return;
    }
    
    this.orderStateManager.setOrderItemsLoading(orderId, true);
    
    this.getOrder(orderId).pipe(
      finalize(() => this.orderStateManager.setOrderItemsLoading(orderId, false))
    ).subscribe({
      next: () => {
        // Order is now loaded with items
      },
      error: (error) => {
        console.warn(`Failed to load items for order ${orderId}:`, error);
      }
    });
  }

  isLoadingOrderItems(orderId: number): boolean {
    return this.orderStateManager.areOrderItemsLoading(orderId);
  }

  // ===== STATE MANAGEMENT METHODS =====

  setCurrentOrderData(orderData: Partial<CreateOrderRequest>): void {
    this.orderStateManager.setCurrentOrderData(orderData);
  }

  getCurrentOrderData(): Partial<CreateOrderRequest> | null {
    return this.orderStateManager.getCurrentOrderData();
  }

  updateCurrentOrderData(updates: Partial<CreateOrderRequest>): void {
    this.orderStateManager.updateCurrentOrderData(updates);
  }

  clearCurrentOrderData(): void {
    this.orderStateManager.clearCurrentOrderData();
  }

  setFilters(filters: OrderFilterOptions): void {
    this.orderStateManager.setFilters(filters);
  }

  updateFilters(updates: Partial<OrderFilterOptions>): void {
    this.orderStateManager.updateFilters(updates);
  }

  clearFilters(): void {
    this.orderStateManager.clearFilters();
  }

  getCurrentFilters(): OrderFilterOptions {
    return this.orderStateManager.getCurrentFilters();
  }

  // ===== SELECTION MANAGEMENT =====

  selectOrder(orderId: number): void {
    this.orderStateManager.selectOrder(orderId);
  }

  deselectOrder(orderId: number): void {
    this.orderStateManager.deselectOrder(orderId);
  }

  toggleOrderSelection(orderId: number): void {
    this.orderStateManager.toggleOrderSelection(orderId);
  }

  selectAllOrders(orderIds: number[]): void {
    this.orderStateManager.selectAllOrders(orderIds);
  }

  clearOrderSelection(): void {
    this.orderStateManager.clearOrderSelection();
  }

  getSelectedOrders(): number[] {
    return this.orderStateManager.getSelectedOrders();
  }

  isOrderSelected(orderId: number): boolean {
    return this.orderStateManager.isOrderSelected(orderId);
  }

  // ===== BULK OPERATIONS =====

  bulkUpdateOrderStatus(orderIds: number[], newStatus: string): void {
    this.orderStateManager.bulkUpdateOrderStatus(orderIds, newStatus);
  }

  bulkDeleteOrders(orderIds: number[]): void {
    this.orderStateManager.bulkDeleteOrders(orderIds);
  }

  // ===== PAGINATION MANAGEMENT =====

  setCurrentPage(page: number): void {
    this.orderStateManager.setCurrentPage(page);
  }

  getCurrentPagination(): { page: number; perPage: number; totalPages: number } {
    return this.orderStateManager.getCurrentPagination();
  }

  resetPagination(): void {
    this.orderStateManager.resetPagination();
  }

  // ===== UTILITY DELEGATIONS =====

  getOrderStatusText(status: any): string {
    return this.orderUtility.getOrderStatusText(status);
  }

  getOrderStatusColor(status: any): string {
    return this.orderUtility.getOrderStatusColor(status);
  }

  getOrderStatusIcon(status: any): string {
    return this.orderUtility.getOrderStatusIcon(status);
  }

  formatCurrency(amount: number): string {
    return this.orderUtility.formatCurrency(amount);
  }

  formatOrderDate(dateString: string): string {
    return this.orderUtility.formatOrderDate(dateString);
  }

  formatOrderId(orderId: number): string {
    return this.orderUtility.formatOrderId(orderId);
  }

  getTotalItemsInOrder(order: OrderModel): number {
    return this.orderUtility.getTotalItemsInOrder(order);
  }

  getOrderSubtotal(order: OrderModel): number {
    return this.orderUtility.getOrderSubtotal(order);
  }

  getEstimatedDeliveryDate(order: OrderModel): Date | null {
    return this.orderUtility.getEstimatedDeliveryDate(order);
  }

  hasTrackingInfo(order: OrderModel): boolean {
    return this.orderUtility.hasTrackingInfo(order);
  }

  getTrackingUrl(order: OrderModel): string | null {
    return this.orderUtility.getTrackingUrl(order);
  }

  getProductNamesFromOrder(order: OrderModel): string {
    return this.orderUtility.getProductNamesFromOrder(order);
  }

  getCustomerName(order: OrderModel): string {
    return this.orderUtility.getCustomerName(order);
  }

  getFormattedShippingAddress(order: OrderModel): string {
    return this.orderUtility.getFormattedShippingAddress(order);
  }

  getShippingMethodName(order: OrderModel): string {
    return this.orderUtility.getShippingMethodName(order);
  }

  getPaymentMethodName(order: OrderModel): string {
    return this.orderUtility.getPaymentMethodName(order);
  }

  getOrderAgeInDays(order: OrderModel): number {
    return this.orderUtility.getOrderAgeInDays(order);
  }

  isRecentOrder(order: OrderModel): boolean {
    return this.orderUtility.isRecentOrder(order);
  }

  // ===== BUSINESS LOGIC DELEGATIONS =====

  canCancelOrder(order: OrderModel): boolean {
    return this.orderBusinessLogic.canCancelOrder(order);
  }

  canReturnOrder(order: OrderModel): boolean {
    return this.orderBusinessLogic.canReturnOrder(order);
  }

  canReorderOrder(order: OrderModel): boolean {
    return this.orderBusinessLogic.canReorderOrder(order);
  }

  calculateOrderTotal(
    cartSubtotal: number, 
    shippingCost: number, 
    taxRate: number = 0,
    discountAmount: number = 0
  ): number {
    return this.orderBusinessLogic.calculateOrderTotal(cartSubtotal, shippingCost, taxRate, discountAmount);
  }

  getOrderPriority(order: OrderModel): 'low' | 'normal' | 'high' | 'urgent' {
    return this.orderBusinessLogic.getOrderPriority(order);
  }

  needsAttention(order: OrderModel): { needsAttention: boolean; reason?: string } {
    return this.orderBusinessLogic.needsAttention(order);
  }

  // ===== ANALYTICS AND REPORTING =====

  calculateOrderAnalytics(orders: OrderModel[]): OrderAnalytics {
    return this.orderBusinessLogic.calculateOrderAnalytics(orders);
  }

  generateOrderSummaryReport(orders: OrderModel[]): any {
    return this.orderUtility.generateOrderSummaryReport(orders);
  }

  getOrdersByStatus(status: string): OrderModel[] {
    return this.orderStateManager.getOrdersByStatus(status);
  }

  getRecentOrders(limit: number = 5): OrderModel[] {
    return this.orderStateManager.getRecentOrders(limit);
  }

  searchOrdersInCache(searchTerm: string): OrderModel[] {
    return this.orderStateManager.searchOrdersInCache(searchTerm);
  }

  getOrdersInDateRange(startDate: Date, endDate: Date): OrderModel[] {
    return this.orderStateManager.getOrdersInDateRange(startDate, endDate);
  }

  getOrdersByAmountRange(minAmount: number, maxAmount: number): OrderModel[] {
    return this.orderStateManager.getOrdersByAmountRange(minAmount, maxAmount);
  }

  // ===== EXPORT AND IMPORT =====

  exportOrdersToCSV(orders: OrderModel[], filename?: string): void {
    this.orderUtility.downloadCSV(orders, filename);
  }

  prepareOrderForExport(order: OrderModel): any {
    return this.orderUtility.prepareOrderForExport(order);
  }

  // ===== SORTING AND GROUPING =====

  sortOrdersInCache(sortBy: 'date' | 'amount' | 'status', ascending: boolean = false): void {
    this.orderStateManager.sortOrdersInCache(sortBy, ascending);
  }

  groupOrdersByStatus(): { [status: string]: OrderModel[] } {
    return this.orderStateManager.groupOrdersByStatus();
  }

  groupOrdersByDateRange(rangeType: 'day' | 'week' | 'month'): { [key: string]: OrderModel[] } {
    return this.orderStateManager.groupOrdersByDateRange(rangeType);
  }

  // ===== RETURN AND REFUND OPERATIONS =====

  createReturnRequest(returnData: Partial<ReturnRequest>): Observable<ReturnRequest> {
    return this.orderBusinessLogic.createReturnRequest(returnData);
  }

  getUserReturnRequests(): Observable<ReturnRequest[]> {
    // Mock implementation - you can replace with actual API call
    return of([]);
  }

  // ===== INVOICE OPERATIONS =====

  generateInvoice(orderId: number): Observable<InvoiceModel> {
    return this.orderBusinessLogic.generateInvoice(orderId);
  }

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
        console.log('Invoice download ready');
      })
    );
  }

  // ===== TRACKING OPERATIONS =====

  getOrderTrackingEvents(orderId: number): Observable<OrderTrackingEvent[]> {
    // Mock implementation - you can replace with actual API call
    return of([]);
  }

  addTrackingEvent(orderId: number, event: Partial<OrderTrackingEvent>): Observable<OrderTrackingEvent> {
    // Mock implementation - you can replace with actual API call
    const mockEvent: OrderTrackingEvent = {
      id: Date.now(),
      order_id: orderId,
      event_type: event.event_type || 'note_added',
      description: event.description || '',
      created_at: Date.now(),
      created_by: this.authService.getUserId() || undefined
    };

    return of(mockEvent);
  }

  // ===== VALIDATION METHODS =====

  validateOrderCompleteness(order: OrderModel): { isComplete: boolean; missingFields: string[] } {
    return this.orderUtility.validateOrderCompleteness(order);
  }

  validateOrderItems(order: OrderModel): { isValid: boolean; errors: string[] } {
    return this.orderUtility.validateOrderItems(order);
  }

  validateShippingAddress(order: OrderModel): { isValid: boolean; errors: string[] } {
    return this.orderUtility.validateShippingAddress(order);
  }

  // ===== PERFORMANCE AND MONITORING =====

  getCacheStats(): any {
    return {
      orderState: this.orderStateManager.getCacheStats(),
      shipping: this.shippingService.getCacheStats(),
      performance: this.orderStateManager.getPerformanceStats()
    };
  }

  getOrderStats(): any {
    return this.orderStateManager.getOrderStats();
  }

  getDebugInfo(): any {
    return {
      orderService: {
        cacheStats: this.getCacheStats(),
        currentFilters: this.getCurrentFilters(),
        pagination: this.getCurrentPagination(),
        selectedOrders: this.getSelectedOrders(),
        hasActiveSubscriptions: this.orderStateManager.hasActiveSubscriptions()
      },
      shippingService: this.shippingService.getCacheStats(),
      shippingIntegration: this.shippingIntegration.getDebugInfo()
    };
  }

  // ===== DEBUGGING METHODS =====

  debugOrder(order: OrderModel): void {
    this.orderUtility.debugOrder(order);
  }

  debugCurrentState(): void {
    this.orderStateManager.debugCurrentState();
    console.group('Shipping Integration Debug');
    console.log(this.shippingIntegration.getDebugInfo());
    console.groupEnd();
  }

  // ===== SUBSCRIPTION MANAGEMENT =====

  hasActiveSubscriptions(): boolean {
    return this.orderStateManager.hasActiveSubscriptions();
  }

  getSubscriptionCounts(): { [key: string]: number } {
    return this.orderStateManager.getSubscriptionCounts();
  }

  // ===== REFRESH AND RESET OPERATIONS =====

  refreshOrders(userId?: number): Observable<OrderModel[]> {
    const targetUserId = userId || this.authService.getUserId();
    if (!targetUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    this.orderStateManager.setGlobalLoading(true);

    return this.orderRepository.getUserOrdersWithRelations(targetUserId).pipe(
      tap(orders => {
        this.orderStateManager.updateOrderCache(orders);
      }),
      finalize(() => {
        this.orderStateManager.setGlobalLoading(false);
      })
    );
  }

  refreshShippingData(): void {
    this.shippingIntegration.refreshShippingCalculations();
    this.shippingService.getUserShippingAddresses(true).subscribe();
    this.shippingService.getShippingMethods(true).subscribe();
  }

  reset(): void {
    this.orderStateManager.clearAllState();
    this.shippingIntegration.reset();
    this.shippingService.clearCache();
  }

  clearCache(): void {
    this.orderStateManager.clearAllState();
    this.shippingService.clearCache();
  }

  // ===== PRIVATE HELPER METHODS =====

  private applyFilters(orders: OrderModel[], filters?: OrderFilterOptions): OrderModel[] {
    if (!filters) return orders;

    let filteredOrders = [...orders];

    if (filters.status) {
      filteredOrders = filteredOrders.filter(order => order.status === filters.status);
    }

    if (filters.date_from) {
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.order_date) >= new Date(filters.date_from!)
      );
    }

    if (filters.date_to) {
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.order_date) <= new Date(filters.date_to!)
      );
    }

    if (filters.min_amount !== undefined) {
      filteredOrders = filteredOrders.filter(order => order.total_amount >= filters.min_amount!);
    }

    if (filters.max_amount !== undefined) {
      filteredOrders = filteredOrders.filter(order => order.total_amount <= filters.max_amount!);
    }

    if (filters.search_term) {
      filteredOrders = filteredOrders.filter(order => 
        this.orderUtility.matchesSearchCriteria(order, filters.search_term!)
      );
    }

    if (filters.shipping_method_id) {
      filteredOrders = filteredOrders.filter(order => 
        order.shipping_methods_id === filters.shipping_method_id
      );
    }

    return filteredOrders;
  }

  // ===== INTEGRATION HELPERS =====

  private integrateWithShippingServices(order: OrderModel): OrderModel {
    // Enhance order with shipping method details from your existing service
    const shippingMethod = this.shippingService.getShippingMethodById(order.shipping_methods_id);
    
    if (shippingMethod) {
      order.shipping_method = shippingMethod;
    }

    return order;
  }

  // ===== COMPATIBILITY METHODS (for backward compatibility) =====

  /**
   * @deprecated Use getUserOrders instead
   */
  getUserOrdersWithItems(page: number = 1, perPage: number = 10, filters?: OrderFilterOptions): Observable<OrderResponse> {
    console.warn('getUserOrdersWithItems is deprecated. Use getUserOrders instead.');
    return this.getUserOrders(page, perPage, filters);
  }

  /**
   * @deprecated Use getOrder instead
   */
  getOrderWithItems(orderId: number): Observable<OrderModel> {
    console.warn('getOrderWithItems is deprecated. Use getOrder instead.');
    return this.getOrder(orderId);
  }

  /**
   * @deprecated Use getOrderItems through getOrder instead
   */
  getOrderItems(orderId: number): Observable<any[]> {
    console.warn('getOrderItems is deprecated. Use getOrder to get complete order with items.');
    return this.getOrder(orderId).pipe(
      map(order => order.order_items || [])
    );
  }

  // ===== ADDITIONAL UTILITY METHODS =====

  isInitialized(): boolean {
    return this.shippingIntegration.isInitialized();
  }

  getServiceVersion(): string {
    return '2.0.0-integrated';
  }

  getIntegrationStatus(): { 
    orderService: boolean; 
    shippingService: boolean; 
    shippingIntegration: boolean; 
  } {
    return {
      orderService: true,
      shippingService: !!this.shippingService,
      shippingIntegration: this.shippingIntegration.isInitialized()
    };
  }
}