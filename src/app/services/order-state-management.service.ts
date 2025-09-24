// services/order-state-management.service.ts - COMPLETE VERSION
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderSummary,
  OrderFilterOptions 
} from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderStateManagementService {

  // Current order state for checkout process
  private currentOrderSubject = new BehaviorSubject<Partial<CreateOrderRequest> | null>(null);
  currentOrder$ = this.currentOrderSubject.asObservable();

  // Order cache for performance
  private orderCacheSubject = new BehaviorSubject<OrderModel[]>([]);
  orderCache$ = this.orderCacheSubject.asObservable();

  // Order summary for quick access
  private orderSummarySubject = new BehaviorSubject<OrderSummary[]>([]);
  orderSummary$ = this.orderSummarySubject.asObservable();

  // Loading states
  private loadingStatesSubject = new BehaviorSubject<{ [orderId: number]: boolean }>({});
  loadingStates$ = this.loadingStatesSubject.asObservable();

  // Current filters
  private filtersSubject = new BehaviorSubject<OrderFilterOptions>({});
  filters$ = this.filtersSubject.asObservable();

  // Pagination state
  private paginationSubject = new BehaviorSubject<{ page: number; perPage: number; totalPages: number }>({
    page: 1,
    perPage: 10,
    totalPages: 1
  });
  pagination$ = this.paginationSubject.asObservable();

  // Track loaded order items to prevent duplicate requests
  private loadedOrderItems = new Set<number>();
  
  // Track loading states for individual orders
  private orderItemsLoading = new Set<number>();

  // Selected orders for bulk operations
  private selectedOrdersSubject = new BehaviorSubject<number[]>([]);
  selectedOrders$ = this.selectedOrdersSubject.asObservable();

  // Order statistics
  private orderStatsSubject = new BehaviorSubject<{
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: number;
  }>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });
  orderStats$ = this.orderStatsSubject.asObservable();

  // ===== CURRENT ORDER MANAGEMENT =====

  setCurrentOrderData(orderData: Partial<CreateOrderRequest>): void {
    this.currentOrderSubject.next(orderData);
    this.logStateChange('setCurrentOrderData', { orderData });
  }

  getCurrentOrderData(): Partial<CreateOrderRequest> | null {
    return this.currentOrderSubject.value;
  }

  updateCurrentOrderData(updates: Partial<CreateOrderRequest>): void {
    const currentOrder = this.currentOrderSubject.value;
    const updatedOrder = { ...currentOrder, ...updates };
    this.currentOrderSubject.next(updatedOrder);
    this.logStateChange('updateCurrentOrderData', { updates });
  }

  clearCurrentOrderData(): void {
    this.currentOrderSubject.next(null);
    this.logStateChange('clearCurrentOrderData');
  }

  // ===== ORDER CACHE MANAGEMENT =====

  addOrderToCache(order: OrderModel): void {
    const currentOrders = this.orderCacheSubject.value;
    const existingIndex = currentOrders.findIndex(o => o.id === order.id);
    
    if (existingIndex !== -1) {
      currentOrders[existingIndex] = order;
    } else {
      currentOrders.unshift(order);
    }
    
    this.orderCacheSubject.next([...currentOrders]);
    this.updateOrderSummary();
    this.updateOrderStats();
    this.logStateChange('addOrderToCache', { orderId: order.id });
  }

  updateOrderInCache(order: OrderModel): void {
    const currentOrders = this.orderCacheSubject.value;
    const index = currentOrders.findIndex(o => o.id === order.id);
    
    if (index !== -1) {
      currentOrders[index] = order;
      this.orderCacheSubject.next([...currentOrders]);
      this.updateOrderSummary();
      this.updateOrderStats();
      this.logStateChange('updateOrderInCache', { orderId: order.id });
    }
  }

  removeOrderFromCache(orderId: number): void {
    const currentOrders = this.orderCacheSubject.value;
    const filteredOrders = currentOrders.filter(o => o.id !== orderId);
    this.orderCacheSubject.next(filteredOrders);
    this.updateOrderSummary();
    this.updateOrderStats();
    this.logStateChange('removeOrderFromCache', { orderId });
  }

  updateOrderCache(orders: OrderModel[]): void {
    this.orderCacheSubject.next(orders);
    this.updateOrderSummary();
    this.updateOrderStats();
    this.logStateChange('updateOrderCache', { count: orders.length });
  }

  getOrderFromCache(orderId: number): OrderModel | null {
    return this.orderCacheSubject.value.find(o => o.id === orderId) || null;
  }

  isOrderInCache(orderId: number): boolean {
    return this.orderCacheSubject.value.some(o => o.id === orderId);
  }

  // ===== ORDER SUMMARY MANAGEMENT =====

  private updateOrderSummary(): void {
    const orders = this.orderCacheSubject.value;
    const summaries = orders.map(order => this.mapOrderToSummary(order));
    this.orderSummarySubject.next(summaries);
  }

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

  getOrderSummary(orderId: number): OrderSummary | null {
    return this.orderSummarySubject.value.find(s => s.id === orderId) || null;
  }

  // ===== LOADING STATE MANAGEMENT =====

  setOrderLoading(orderId: number, loading: boolean): void {
    const currentStates = this.loadingStatesSubject.value;
    const updatedStates = { ...currentStates };
    
    if (loading) {
      updatedStates[orderId] = true;
    } else {
      delete updatedStates[orderId];
    }
    
    this.loadingStatesSubject.next(updatedStates);
    this.logStateChange('setOrderLoading', { orderId, loading });
  }

  isOrderLoading(orderId: number): boolean {
    return this.loadingStatesSubject.value[orderId] || false;
  }

  setGlobalLoading(loading: boolean): void {
    const currentStates = this.loadingStatesSubject.value;
    const updatedStates = loading ? { ...currentStates, global: true } : { ...currentStates };
    
    if (!loading) {
      delete (updatedStates as any).global;
    }
    
    this.loadingStatesSubject.next(updatedStates);
    this.logStateChange('setGlobalLoading', { loading });
  }

  isGlobalLoading(): boolean {
    return !!(this.loadingStatesSubject.value as any).global;
  }

  // ===== ORDER ITEMS LOADING MANAGEMENT =====

  markOrderItemsAsLoaded(orderId: number): void {
    this.loadedOrderItems.add(orderId);
    this.logStateChange('markOrderItemsAsLoaded', { orderId });
  }

  areOrderItemsLoaded(orderId: number): boolean {
    return this.loadedOrderItems.has(orderId);
  }

  setOrderItemsLoading(orderId: number, loading: boolean): void {
    if (loading) {
      this.orderItemsLoading.add(orderId);
    } else {
      this.orderItemsLoading.delete(orderId);
    }
    this.logStateChange('setOrderItemsLoading', { orderId, loading });
  }

  areOrderItemsLoading(orderId: number): boolean {
    return this.orderItemsLoading.has(orderId);
  }

  // ===== FILTER MANAGEMENT =====

  setFilters(filters: OrderFilterOptions): void {
    this.filtersSubject.next(filters);
    this.logStateChange('setFilters', { filters });
  }

  updateFilters(updates: Partial<OrderFilterOptions>): void {
    const currentFilters = this.filtersSubject.value;
    const updatedFilters = { ...currentFilters, ...updates };
    this.filtersSubject.next(updatedFilters);
    this.logStateChange('updateFilters', { updates });
  }

  clearFilters(): void {
    this.filtersSubject.next({});
    this.logStateChange('clearFilters');
  }

  getCurrentFilters(): OrderFilterOptions {
    return this.filtersSubject.value;
  }

  // ===== PAGINATION MANAGEMENT =====

  setPagination(page: number, perPage: number, totalPages: number): void {
    this.paginationSubject.next({ page, perPage, totalPages });
    this.logStateChange('setPagination', { page, perPage, totalPages });
  }

  setCurrentPage(page: number): void {
    const current = this.paginationSubject.value;
    this.paginationSubject.next({ ...current, page });
    this.logStateChange('setCurrentPage', { page });
  }

  getCurrentPagination(): { page: number; perPage: number; totalPages: number } {
    return this.paginationSubject.value;
  }

  resetPagination(): void {
    const current = this.paginationSubject.value;
    this.paginationSubject.next({ ...current, page: 1 });
    this.logStateChange('resetPagination');
  }

  // ===== SELECTION MANAGEMENT =====

  selectOrder(orderId: number): void {
    const currentSelected = this.selectedOrdersSubject.value;
    if (!currentSelected.includes(orderId)) {
      this.selectedOrdersSubject.next([...currentSelected, orderId]);
      this.logStateChange('selectOrder', { orderId });
    }
  }

  deselectOrder(orderId: number): void {
    const currentSelected = this.selectedOrdersSubject.value;
    const filtered = currentSelected.filter(id => id !== orderId);
    this.selectedOrdersSubject.next(filtered);
    this.logStateChange('deselectOrder', { orderId });
  }

  toggleOrderSelection(orderId: number): void {
    const currentSelected = this.selectedOrdersSubject.value;
    if (currentSelected.includes(orderId)) {
      this.deselectOrder(orderId);
    } else {
      this.selectOrder(orderId);
    }
  }

  selectAllOrders(orderIds: number[]): void {
    this.selectedOrdersSubject.next([...orderIds]);
    this.logStateChange('selectAllOrders', { count: orderIds.length });
  }

  clearOrderSelection(): void {
    this.selectedOrdersSubject.next([]);
    this.logStateChange('clearOrderSelection');
  }

  getSelectedOrders(): number[] {
    return this.selectedOrdersSubject.value;
  }

  isOrderSelected(orderId: number): boolean {
    return this.selectedOrdersSubject.value.includes(orderId);
  }

  getSelectedOrdersCount(): number {
    return this.selectedOrdersSubject.value.length;
  }

  // ===== ORDER STATISTICS =====

  private updateOrderStats(): void {
    const orders = this.orderCacheSubject.value;
    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      completedOrders: orders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
      totalRevenue: orders.reduce((total, order) => total + order.total_amount, 0)
    };
    
    this.orderStatsSubject.next(stats);
  }

  getOrderStats(): { totalOrders: number; pendingOrders: number; completedOrders: number; totalRevenue: number } {
    return this.orderStatsSubject.value;
  }

  // ===== UTILITY METHODS =====

  clearAllState(): void {
    this.currentOrderSubject.next(null);
    this.orderCacheSubject.next([]);
    this.orderSummarySubject.next([]);
    this.loadingStatesSubject.next({});
    this.filtersSubject.next({});
    this.paginationSubject.next({ page: 1, perPage: 10, totalPages: 1 });
    this.selectedOrdersSubject.next([]);
    this.orderStatsSubject.next({ totalOrders: 0, pendingOrders: 0, completedOrders: 0, totalRevenue: 0 });
    this.loadedOrderItems.clear();
    this.orderItemsLoading.clear();
    this.logStateChange('clearAllState');
  }

  getCacheStats(): {
    totalOrders: number;
    loadedItemCounts: number;
    loadingItemCounts: number;
    selectedOrdersCount: number;
  } {
    return {
      totalOrders: this.orderCacheSubject.value.length,
      loadedItemCounts: this.loadedOrderItems.size,
      loadingItemCounts: this.orderItemsLoading.size,
      selectedOrdersCount: this.selectedOrdersSubject.value.length
    };
  }

  getOrdersByStatus(status: string): OrderModel[] {
    return this.orderCacheSubject.value.filter(order => order.status === status);
  }

  getRecentOrders(limit: number = 5): OrderModel[] {
    return this.orderCacheSubject.value
      .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
      .slice(0, limit);
  }

  searchOrdersInCache(searchTerm: string): OrderModel[] {
    const term = searchTerm.toLowerCase();
    return this.orderCacheSubject.value.filter(order => 
      order.id.toString().includes(term) ||
      order.notes.toLowerCase().includes(term) ||
      order.status.toLowerCase().includes(term)
    );
  }

  getOrdersInDateRange(startDate: Date, endDate: Date): OrderModel[] {
    return this.orderCacheSubject.value.filter(order => {
      const orderDate = new Date(order.order_date);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

  getOrdersByAmountRange(minAmount: number, maxAmount: number): OrderModel[] {
    return this.orderCacheSubject.value.filter(order => 
      order.total_amount >= minAmount && order.total_amount <= maxAmount
    );
  }

  // ===== BULK OPERATIONS =====

  bulkUpdateOrderStatus(orderIds: number[], newStatus: string): void {
    const currentOrders = this.orderCacheSubject.value;
    const updatedOrders = currentOrders.map(order => {
      if (orderIds.includes(order.id)) {
        return { ...order, status: newStatus as any };
      }
      return order;
    });
    
    this.orderCacheSubject.next(updatedOrders);
    this.updateOrderSummary();
    this.updateOrderStats();
    this.logStateChange('bulkUpdateOrderStatus', { orderIds, newStatus });
  }

  bulkDeleteOrders(orderIds: number[]): void {
    const currentOrders = this.orderCacheSubject.value;
    const filteredOrders = currentOrders.filter(order => !orderIds.includes(order.id));
    
    this.orderCacheSubject.next(filteredOrders);
    this.updateOrderSummary();
    this.updateOrderStats();
    
    // Clear selection
    this.clearOrderSelection();
    this.logStateChange('bulkDeleteOrders', { orderIds });
  }

  // ===== SORTING AND GROUPING =====

  sortOrdersInCache(sortBy: 'date' | 'amount' | 'status', ascending: boolean = false): void {
    const currentOrders = [...this.orderCacheSubject.value];
    
    currentOrders.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
          break;
        case 'amount':
          comparison = a.total_amount - b.total_amount;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return ascending ? comparison : -comparison;
    });
    
    this.orderCacheSubject.next(currentOrders);
    this.logStateChange('sortOrdersInCache', { sortBy, ascending });
  }

  groupOrdersByStatus(): { [status: string]: OrderModel[] } {
    const orders = this.orderCacheSubject.value;
    return orders.reduce((groups, order) => {
      const status = order.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(order);
      return groups;
    }, {} as { [status: string]: OrderModel[] });
  }

  groupOrdersByDateRange(rangeType: 'day' | 'week' | 'month'): { [key: string]: OrderModel[] } {
    const orders = this.orderCacheSubject.value;
    
    return orders.reduce((groups, order) => {
      const date = new Date(order.order_date);
      let key: string;
      
      switch (rangeType) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = startOfWeek.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
      return groups;
    }, {} as { [key: string]: OrderModel[] });
  }

  // ===== DEBUGGING AND LOGGING =====

  private logStateChange(action: string, data?: any): void {
    if (console && console.debug) {
      console.debug(`[OrderState] ${action}`, data || '');
    }
  }

  debugCurrentState(): void {
    const state = {
      currentOrder: this.currentOrderSubject.value,
      ordersInCache: this.orderCacheSubject.value.length,
      loadingStates: this.loadingStatesSubject.value,
      filters: this.filtersSubject.value,
      pagination: this.paginationSubject.value,
      selectedOrders: this.selectedOrdersSubject.value,
      loadedItems: Array.from(this.loadedOrderItems),
      loadingItems: Array.from(this.orderItemsLoading),
      stats: this.orderStatsSubject.value
    };
    
    console.group('Order State Debug');
    console.table(state);
    console.groupEnd();
  }

  // ===== EXPORT/IMPORT STATE =====

  exportState(): any {
    return {
      orders: this.orderCacheSubject.value,
      filters: this.filtersSubject.value,
      pagination: this.paginationSubject.value,
      selectedOrders: this.selectedOrdersSubject.value,
      loadedItems: Array.from(this.loadedOrderItems),
      timestamp: Date.now()
    };
  }

  importState(state: any): void {
    if (state.orders) {
      this.orderCacheSubject.next(state.orders);
      this.updateOrderSummary();
      this.updateOrderStats();
    }
    
    if (state.filters) {
      this.filtersSubject.next(state.filters);
    }
    
    if (state.pagination) {
      this.paginationSubject.next(state.pagination);
    }
    
    if (state.selectedOrders) {
      this.selectedOrdersSubject.next(state.selectedOrders);
    }
    
    if (state.loadedItems) {
      this.loadedOrderItems.clear();
      state.loadedItems.forEach((id: number) => this.loadedOrderItems.add(id));
    }
    
    this.logStateChange('importState', { timestamp: state.timestamp });
  }

  // ===== PERFORMANCE MONITORING =====

  getPerformanceStats(): {
    cacheSize: number;
    loadedItemsSize: number;
    selectedOrdersSize: number;
    memoryUsage: string;
  } {
    const cacheSize = JSON.stringify(this.orderCacheSubject.value).length;
    
    return {
      cacheSize: this.orderCacheSubject.value.length,
      loadedItemsSize: this.loadedOrderItems.size,
      selectedOrdersSize: this.selectedOrdersSubject.value.length,
      memoryUsage: `${Math.round(cacheSize / 1024)}KB`
    };
  }

  // ===== SUBSCRIPTION MANAGEMENT =====

  hasActiveSubscriptions(): boolean {
    return this.currentOrderSubject.observers.length > 0 ||
           this.orderCacheSubject.observers.length > 0 ||
           this.orderSummarySubject.observers.length > 0 ||
           this.loadingStatesSubject.observers.length > 0 ||
           this.filtersSubject.observers.length > 0 ||
           this.paginationSubject.observers.length > 0 ||
           this.selectedOrdersSubject.observers.length > 0 ||
           this.orderStatsSubject.observers.length > 0;
  }

  getSubscriptionCounts(): { [key: string]: number } {
    return {
      currentOrder: this.currentOrderSubject.observers.length,
      orderCache: this.orderCacheSubject.observers.length,
      orderSummary: this.orderSummarySubject.observers.length,
      loadingStates: this.loadingStatesSubject.observers.length,
      filters: this.filtersSubject.observers.length,
      pagination: this.paginationSubject.observers.length,
      selectedOrders: this.selectedOrdersSubject.observers.length,
      orderStats: this.orderStatsSubject.observers.length
    };
  }
}