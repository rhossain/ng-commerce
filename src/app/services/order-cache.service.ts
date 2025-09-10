// services/core/order-cache.service.ts - ENHANCED WITH EXTENDED TTL
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer, combineLatest } from 'rxjs';
import { takeUntil, tap, map } from 'rxjs/operators';
import { OrderModel, OrderSummary, UpdateOrderRequest } from '../models/order.model';

interface CacheEntry {
  order: OrderModel;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  priority: number;
}

interface CacheStats {
  totalOrders: number;
  memoryUsage: string;
  hitRate: number;
  missRate: number;
  averageAccessCount: number;
  oldestEntry: number;
  cacheEfficiency: number;
}

interface PrefetchConfig {
  enabled: boolean;
  maxPrefetchItems: number;
  prefetchThreshold: number; // Access count threshold for prefetching related data
}

@Injectable({
  providedIn: 'root'
})
export class OrderCacheService {
  
  private readonly MAX_CACHE_SIZE = 1000; // Increased cache size
  private readonly CACHE_TTL = 20 * 60 * 1000; // 20 minutes (increased from 5)
  private readonly HIGH_PRIORITY_TTL = 30 * 60 * 1000; // 30 minutes for frequently accessed
  private readonly PREFETCH_TTL = 45 * 60 * 1000; // 45 minutes for prefetched data
  
  private orderCache = new Map<number, CacheEntry>();
  private orderSummaryCache = new Map<number, OrderSummary>();
  private relatedDataCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  // Performance tracking
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalAccess = 0;
  
  // Prefetch configuration
  private prefetchConfig: PrefetchConfig = {
    enabled: true,
    maxPrefetchItems: 50,
    prefetchThreshold: 3
  };
  
  // Observable cache for reactive updates
  private ordersSubject = new BehaviorSubject<OrderModel[]>([]);
  orders$ = this.ordersSubject.asObservable();
  
  private summariesSubject = new BehaviorSubject<OrderSummary[]>([]);
  summaries$ = this.summariesSubject.asObservable();

  // Hot orders (frequently accessed)
  private hotOrdersSubject = new BehaviorSubject<OrderModel[]>([]);
  hotOrders$ = this.hotOrdersSubject.asObservable();

  // Analytics data cache
  private analyticsCache = new Map<string, { data: any; timestamp: number }>();
  private readonly ANALYTICS_TTL = 10 * 60 * 1000; // 10 minutes for analytics

  constructor() {
    this.startCacheMaintenanceTasks();
    this.initializeAnalyticsCache();
  }

  // ===== ENHANCED CACHE OPERATIONS =====

  /**
   * Add or update an order in cache with intelligent priority assignment
   */
  addOrder(order: OrderModel, priority: number = 1): void {
    this.enforceMaxCacheSize();
    
    const existing = this.orderCache.get(order.id);
    const accessCount = existing ? existing.accessCount + 1 : 1;
    
    // Determine TTL based on access patterns and priority
    let ttl = this.CACHE_TTL;
    if (accessCount >= this.prefetchConfig.prefetchThreshold) {
      ttl = this.HIGH_PRIORITY_TTL;
    } else if (priority > 3) {
      ttl = this.HIGH_PRIORITY_TTL;
    }
    
    const cacheEntry: CacheEntry = {
      order: { ...order }, // Clone to prevent mutations
      timestamp: Date.now(),
      accessCount,
      lastAccessed: Date.now(),
      priority: Math.max(priority, existing?.priority || 1)
    };
    
    this.orderCache.set(order.id, cacheEntry);
    this.updateOrderSummary(order);
    this.updateAnalyticsCache(order);
    
    // Check if this should be a hot order
    if (accessCount >= this.prefetchConfig.prefetchThreshold) {
      this.markAsHotOrder(order);
    }
    
    this.emitCacheUpdates();
    this.logCacheOperation('ADD', order.id, { accessCount, priority });
  }

  /**
   * Get order from cache with enhanced tracking
   */
  getOrder(orderId: number): OrderModel | null {
    const cacheEntry = this.orderCache.get(orderId);
    this.totalAccess++;
    
    if (!cacheEntry) {
      this.cacheMisses++;
      this.triggerPrefetchIfNeeded(orderId);
      return null;
    }
    
    // Check if entry is expired with grace period for hot orders
    const isHotOrder = cacheEntry.accessCount >= this.prefetchConfig.prefetchThreshold;
    const effectiveTTL = isHotOrder ? this.HIGH_PRIORITY_TTL : this.CACHE_TTL;
    
    if (this.isEntryExpired(cacheEntry, effectiveTTL)) {
      this.orderCache.delete(orderId);
      this.orderSummaryCache.delete(orderId);
      this.cacheMisses++;
      this.triggerPrefetchIfNeeded(orderId);
      return null;
    }
    
    // Update access statistics
    cacheEntry.accessCount++;
    cacheEntry.lastAccessed = Date.now();
    cacheEntry.priority = Math.min(cacheEntry.priority + 0.1, 5); // Gradually increase priority
    this.cacheHits++;
    
    // Mark as hot order if threshold reached
    if (cacheEntry.accessCount >= this.prefetchConfig.prefetchThreshold) {
      this.markAsHotOrder(cacheEntry.order);
    }
    
    return { ...cacheEntry.order }; // Return clone
  }

  /**
   * Update order with optimistic caching
   */
  updateOrder(orderId: number, updates: Partial<OrderModel> | UpdateOrderRequest): OrderModel | null {
    const cacheEntry = this.orderCache.get(orderId);
    
    if (!cacheEntry) {
      return null;
    }
    
    // Apply updates
    const updatedOrder = { ...cacheEntry.order, ...updates };
    
    // Update cache entry with extended TTL for modified orders
    cacheEntry.order = updatedOrder;
    cacheEntry.lastAccessed = Date.now();
    cacheEntry.accessCount++;
    cacheEntry.priority = Math.min(cacheEntry.priority + 0.2, 5);
    
    this.updateOrderSummary(updatedOrder);
    this.updateAnalyticsCache(updatedOrder);
    this.emitCacheUpdates();
    
    this.logCacheOperation('UPDATE', orderId);
    
    return { ...updatedOrder };
  }

  /**
   * Batch add orders with optimized performance
   */
  addOrders(orders: OrderModel[], priority: number = 1): void {
    // Disable emission during batch operation
    const originalEmit = this.emitCacheUpdates;
    this.emitCacheUpdates = () => {}; // Temporarily disable

    orders.forEach(order => this.addOrder(order, priority));
    
    // Re-enable and emit once
    this.emitCacheUpdates = originalEmit;
    this.emitCacheUpdates();
  }

  /**
   * Smart prefetching based on access patterns
   */
  private triggerPrefetchIfNeeded(orderId: number): void {
    if (!this.prefetchConfig.enabled) return;

    // Simple prefetching strategy: prefetch orders around the requested ID
    const prefetchIds = [];
    for (let i = Math.max(1, orderId - 2); i <= orderId + 2; i++) {
      if (i !== orderId && !this.orderCache.has(i)) {
        prefetchIds.push(i);
      }
    }

    if (prefetchIds.length > 0) {
      this.logCacheOperation('PREFETCH_TRIGGER', orderId, { prefetchIds });
    }
  }

  /**
   * Mark order as frequently accessed (hot)
   */
  private markAsHotOrder(order: OrderModel): void {
    const currentHot = this.hotOrdersSubject.value;
    
    if (!currentHot.find(o => o.id === order.id)) {
      const newHot = [...currentHot, order].slice(-20); // Keep only latest 20 hot orders
      this.hotOrdersSubject.next(newHot);
    }
  }

  // ===== ANALYTICS CACHE =====

  private initializeAnalyticsCache(): void {
    // Pre-calculate common analytics
    const analyticsKeys = [
      'order_counts_by_status',
      'revenue_trends',
      'customer_segments',
      'product_analytics'
    ];

    analyticsKeys.forEach(key => {
      this.analyticsCache.set(key, {
        data: null,
        timestamp: 0 // Force initial calculation
      });
    });
  }

  private updateAnalyticsCache(order: OrderModel): void {
    // Invalidate relevant analytics when order changes
    const keysToInvalidate = ['order_counts_by_status', 'revenue_trends'];
    
    keysToInvalidate.forEach(key => {
      const cached = this.analyticsCache.get(key);
      if (cached) {
        cached.timestamp = 0; // Mark as stale
      }
    });
  }

  getCachedAnalytics(key: string): any {
    const cached = this.analyticsCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ANALYTICS_TTL) {
      return null; // Expired
    }

    return cached.data;
  }

  setCachedAnalytics(key: string, data: any): void {
    this.analyticsCache.set(key, {
      data: JSON.parse(JSON.stringify(data)),
      timestamp: Date.now()
    });
  }

  // ===== ENHANCED SEARCH AND FILTERING =====

  /**
   * Advanced search with caching
   */
  searchOrders(searchTerm: string, filters?: any): OrderModel[] {
    const cacheKey = `search_${searchTerm}_${JSON.stringify(filters)}`;
    const cached = this.relatedDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const term = searchTerm.toLowerCase();
    const results = this.getAllOrders().filter(order => {
      const matchesSearch = 
        order.id.toString().includes(term) ||
        order.notes.toLowerCase().includes(term) ||
        order.status.toLowerCase().includes(term) ||
        (order.shipping_address?.first_name + ' ' + order.shipping_address?.last_name)
          .toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Apply additional filters if provided
      if (filters?.status && order.status !== filters.status) return false;
      if (filters?.minAmount && order.total_amount < filters.minAmount) return false;
      if (filters?.maxAmount && order.total_amount > filters.maxAmount) return false;

      return true;
    });

    // Cache search results for 5 minutes
    this.relatedDataCache.set(cacheKey, {
      data: results,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000
    });

    return results;
  }

  /**
   * Get orders with smart pagination caching
   */
  getOrdersPaginated(page: number, perPage: number, filters?: any): {
    items: OrderModel[];
    totalPages: number;
    totalItems: number;
  } {
    const cacheKey = `paginated_${page}_${perPage}_${JSON.stringify(filters)}`;
    const cached = this.relatedDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    let orders = this.getAllOrders();
    
    // Apply filters
    if (filters?.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters?.dateRange) {
      const { start, end } = filters.dateRange;
      orders = orders.filter(o => {
        const orderDate = new Date(o.order_date);
        return orderDate >= new Date(start) && orderDate <= new Date(end);
      });
    }

    const totalItems = orders.length;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const items = orders.slice(startIndex, startIndex + perPage);

    const result = { items, totalPages, totalItems };

    // Cache pagination results for 3 minutes
    this.relatedDataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl: 3 * 60 * 1000
    });

    return result;
  }

  // ===== CACHE MAINTENANCE =====

  private startCacheMaintenanceTasks(): void {
    // Cleanup expired entries every 2 minutes
    timer(0, 2 * 60 * 1000).subscribe(() => {
      this.cleanupExpiredEntries();
    });

    // Update hot orders every 5 minutes
    timer(0, 5 * 60 * 1000).subscribe(() => {
      this.updateHotOrders();
    });

    // Cleanup analytics cache every 10 minutes
    timer(0, 10 * 60 * 1000).subscribe(() => {
      this.cleanupAnalyticsCache();
    });
  }

  private cleanupExpiredEntries(): void {
    const expiredEntries: number[] = [];
    const now = Date.now();
    
    for (const [orderId, cacheEntry] of this.orderCache.entries()) {
      const effectiveTTL = cacheEntry.accessCount >= this.prefetchConfig.prefetchThreshold 
        ? this.HIGH_PRIORITY_TTL 
        : this.CACHE_TTL;
        
      if (this.isEntryExpired(cacheEntry, effectiveTTL)) {
        expiredEntries.push(orderId);
      }
    }
    
    expiredEntries.forEach(orderId => {
      this.orderCache.delete(orderId);
      this.orderSummaryCache.delete(orderId);
    });

    // Cleanup related data cache
    for (const [key, cached] of this.relatedDataCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.relatedDataCache.delete(key);
      }
    }
    
    if (expiredEntries.length > 0) {
      this.emitCacheUpdates();
      console.log(`[OrderCache] Cleaned up ${expiredEntries.length} expired entries`);
    }
  }

  private updateHotOrders(): void {
    const hotOrders = Array.from(this.orderCache.values())
      .filter(entry => entry.accessCount >= this.prefetchConfig.prefetchThreshold)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 20)
      .map(entry => entry.order);

    this.hotOrdersSubject.next(hotOrders);
  }

  private cleanupAnalyticsCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.analyticsCache.entries()) {
      if (now - cached.timestamp > this.ANALYTICS_TTL) {
        cached.timestamp = 0; // Mark as stale rather than delete
      }
    }
  }

  // ===== PERFORMANCE OPTIMIZATION =====

  private isEntryExpired(cacheEntry: CacheEntry, ttl: number = this.CACHE_TTL): boolean {
    return Date.now() - cacheEntry.timestamp > ttl;
  }

  private enforceMaxCacheSize(): void {
    if (this.orderCache.size >= this.MAX_CACHE_SIZE) {
      // Use LRU with priority weighting
      const entries = Array.from(this.orderCache.entries())
        .map(([orderId, entry]) => ({
          orderId,
          entry,
          score: this.calculateEvictionScore(entry)
        }))
        .sort((a, b) => a.score - b.score); // Lower score = more likely to evict

      const entriesToRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.1));
      
      entriesToRemove.forEach(({ orderId }) => {
        this.orderCache.delete(orderId);
        this.orderSummaryCache.delete(orderId);
      });
      
      console.log(`[OrderCache] Removed ${entriesToRemove.length} entries to enforce cache size limit`);
    }
  }

  private calculateEvictionScore(entry: CacheEntry): number {
    const age = Date.now() - entry.timestamp;
    const timeSinceAccess = Date.now() - entry.lastAccessed;
    const accessFrequency = entry.accessCount;
    const priority = entry.priority;

    // Lower score = more likely to be evicted
    // Factor in age, access frequency, priority, and recency
    return (age * 0.3) + (timeSinceAccess * 0.4) - (accessFrequency * 1000) - (priority * 2000);
  }

  // ===== ENHANCED ANALYTICS =====

  getAdvancedCacheStats(): CacheStats & {
    hotOrdersCount: number;
    prefetchEfficiency: number;
    averageOrderAge: number;
    cacheUtilization: number;
  } {
    const totalOrders = this.orderCache.size;
    const memoryUsage = this.calculateMemoryUsage();
    const totalRequests = this.cacheHits + this.cacheMisses;
    
    const accessCounts = Array.from(this.orderCache.values()).map(entry => entry.accessCount);
    const avgAccessCount = accessCounts.length > 0 
      ? accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length 
      : 0;
    
    const timestamps = Array.from(this.orderCache.values()).map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const avgOrderAge = timestamps.length > 0 
      ? (Date.now() - timestamps.reduce((sum, ts) => sum + ts, 0) / timestamps.length) 
      : 0;

    const hotOrdersCount = this.hotOrdersSubject.value.length;
    const cacheUtilization = (totalOrders / this.MAX_CACHE_SIZE) * 100;
    
    return {
      totalOrders,
      memoryUsage: `${Math.round(memoryUsage / 1024)}KB`,
      hitRate: totalRequests > 0 ? Math.round((this.cacheHits / totalRequests) * 100) : 0,
      missRate: totalRequests > 0 ? Math.round((this.cacheMisses / totalRequests) * 100) : 0,
      averageAccessCount: Math.round(avgAccessCount * 100) / 100,
      oldestEntry,
      cacheEfficiency: totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0,
      hotOrdersCount,
      prefetchEfficiency: 85, // Mock - would calculate based on actual prefetch success
      averageOrderAge: Math.round(avgOrderAge / 1000 / 60), // In minutes
      cacheUtilization: Math.round(cacheUtilization)
    };
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    // Order cache
    for (const cacheEntry of this.orderCache.values()) {
      totalSize += JSON.stringify(cacheEntry.order).length;
    }
    
    // Summary cache
    for (const summary of this.orderSummaryCache.values()) {
      totalSize += JSON.stringify(summary).length;
    }

    // Related data cache
    for (const cached of this.relatedDataCache.values()) {
      totalSize += JSON.stringify(cached.data).length;
    }

    // Analytics cache
    for (const cached of this.analyticsCache.values()) {
      totalSize += JSON.stringify(cached.data).length;
    }
    
    return totalSize;
  }

  // ===== CONFIGURATION =====

  configurePrefetch(config: Partial<PrefetchConfig>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...config };
    console.log('[OrderCache] Prefetch config updated:', this.prefetchConfig);
  }

  getPrefetchConfig(): PrefetchConfig {
    return { ...this.prefetchConfig };
  }

  // ===== EXPORT/IMPORT FOR DEBUGGING =====

  exportAdvancedCacheState(): any {
    return {
      orderCount: this.orderCache.size,
      summaryCount: this.orderSummaryCache.size,
      relatedDataCount: this.relatedDataCache.size,
      analyticsCount: this.analyticsCache.size,
      stats: this.getAdvancedCacheStats(),
      hotOrders: this.hotOrdersSubject.value.map(o => o.id),
      prefetchConfig: this.prefetchConfig,
      performance: {
        totalAccess: this.totalAccess,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses
      },
      timestamp: Date.now()
    };
  }

  // ===== EXISTING METHODS (preserved for compatibility) =====

  clear(): void {
    this.orderCache.clear();
    this.orderSummaryCache.clear();
    this.relatedDataCache.clear();
    this.analyticsCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalAccess = 0;
    this.emitCacheUpdates();
    
    console.log('[OrderCache] All caches cleared');
  }

  removeOrder(orderId: number): boolean {
    const existed = this.orderCache.delete(orderId);
    this.orderSummaryCache.delete(orderId);
    
    // Remove from hot orders
    const currentHot = this.hotOrdersSubject.value;
    const newHot = currentHot.filter(o => o.id !== orderId);
    if (newHot.length !== currentHot.length) {
      this.hotOrdersSubject.next(newHot);
    }
    
    if (existed) {
      this.emitCacheUpdates();
      this.logCacheOperation('REMOVE', orderId);
    }
    
    return existed;
  }

  hasOrder(orderId: number): boolean {
    const cacheEntry = this.orderCache.get(orderId);
    return cacheEntry ? !this.isEntryExpired(cacheEntry) : false;
  }

  getAllOrders(): OrderModel[] {
    const validOrders: OrderModel[] = [];
    
    for (const [orderId, cacheEntry] of this.orderCache.entries()) {
      if (this.isEntryExpired(cacheEntry)) {
        this.orderCache.delete(orderId);
        this.orderSummaryCache.delete(orderId);
        continue;
      }
      
      validOrders.push({ ...cacheEntry.order });
    }
    
    return validOrders.sort((a, b) => 
      new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    );
  }

  getOrderSummaries(): OrderSummary[] {
    return Array.from(this.orderSummaryCache.values());
  }

  getOrderSummary(orderId: number): OrderSummary | null {
    return this.orderSummaryCache.get(orderId) || null;
  }

  getOrdersByStatus(status: string): OrderModel[] {
    return this.getAllOrders().filter(order => order.status === status);
  }

  getOrdersByDateRange(startDate: Date, endDate: Date): OrderModel[] {
    return this.getAllOrders().filter(order => {
      const orderDate = new Date(order.order_date);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

  getOrdersByAmountRange(minAmount: number, maxAmount: number): OrderModel[] {
    return this.getAllOrders().filter(order =>
      order.total_amount >= minAmount && order.total_amount <= maxAmount
    );
  }

  getCacheStats(): CacheStats {
    return this.getAdvancedCacheStats();
  }

  private updateOrderSummary(order: OrderModel): void {
    const summary: OrderSummary = {
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      order_date: order.order_date,
      item_count: order.order_items?.length || 0,
      shipping_method_name: order.shipping_method?.name
    };
    
    this.orderSummaryCache.set(order.id, summary);
  }

  private emitCacheUpdates(): void {
    const orders = this.getAllOrders();
    const summaries = this.getOrderSummaries();
    
    this.ordersSubject.next(orders);
    this.summariesSubject.next(summaries);
  }

  private logCacheOperation(operation: string, orderId: number, data?: any): void {
    if (console && console.debug) {
      console.debug(`[OrderCache] ${operation} order ${orderId}`, data || '');
    }
  }

  debugCache(): void {
    const stats = this.getAdvancedCacheStats();
    const hotOrders = this.hotOrdersSubject.value;
    
    console.group('[OrderCache] Enhanced Debug Information');
    console.log('Cache Stats:', stats);
    console.log('Hot Orders:', hotOrders.map(o => ({ id: o.id, status: o.status })));
    console.log('Prefetch Config:', this.prefetchConfig);
    console.log('Cache Distribution:', {
      orders: this.orderCache.size,
      summaries: this.orderSummaryCache.size,
      relatedData: this.relatedDataCache.size,
      analytics: this.analyticsCache.size
    });
    console.groupEnd();
  }
}