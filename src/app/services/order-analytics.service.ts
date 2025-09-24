// services/analytics/order-analytics.service.ts
import { Injectable } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { OrderCacheService } from './order-cache.service';
import { OrderModel, OrderStatus, OrderAnalytics } from '../models/order.model';

export interface AnalyticsMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  conversionRate: number;
  ordersByStatus: { [status: string]: number };
  revenueByStatus: { [status: string]: number };
  monthlyTrends: MonthlyTrend[];
  topProducts: ProductAnalytics[];
  customerSegments: CustomerSegment[];
}

export interface MonthlyTrend {
  month: string;
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
  growthRate: number;
}

export interface ProductAnalytics {
  productId: number;
  productName: string;
  quantity: number;
  revenue: number;
  orderCount: number;
}

export interface CustomerSegment {
  segment: string;
  orderCount: number;
  revenue: number;
  customerCount: number;
  averageOrderValue: number;
}

export interface TimeRangeFilter {
  startDate: Date;
  endDate: Date;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

@Injectable({
  providedIn: 'root'
})
export class OrderAnalyticsService {

  // Cached analytics to avoid recalculation - initialized after constructor
  private analyticsCache$: Observable<AnalyticsMetrics>;

  constructor(private orderCache: OrderCacheService) {
    // Initialize the cached analytics observable after dependency injection
    this.analyticsCache$ = combineLatest([
      this.orderCache.orders$
    ]).pipe(
      map(([orders]) => this.calculateComprehensiveAnalytics(orders)),
      shareReplay(1)
    );
  }

  // ===== MAIN ANALYTICS METHODS =====

  /**
   * Get comprehensive analytics for all orders
   */
  getOrderAnalytics(timeRange?: TimeRangeFilter): Observable<AnalyticsMetrics> {
    return this.analyticsCache$.pipe(
      map(analytics => {
        if (timeRange) {
          return this.filterAnalyticsByTimeRange(analytics, timeRange);
        }
        return analytics;
      })
    );
  }

  /**
   * Get real-time order statistics
   */
  getOrderStatistics(): Observable<{
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    todaysOrders: number;
    weeklyGrowth: number;
  }> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const todaysOrders = orders.filter(order => 
          order.order_date.startsWith(todayStr)
        ).length;

        const thisWeekOrders = orders.filter(order => 
          new Date(order.order_date) > lastWeek
        ).length;

        const lastWeekOrders = orders.filter(order => {
          const orderDate = new Date(order.order_date);
          const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
          return orderDate > twoWeeksAgo && orderDate <= lastWeek;
        }).length;

        const weeklyGrowth = lastWeekOrders > 0 
          ? ((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100 
          : 0;

        return {
          totalOrders: orders.length,
          pendingOrders: orders.filter(o => o.status === 'pending').length,
          completedOrders: orders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
          cancelledOrders: orders.filter(o => o.status === 'cancelled').length,
          totalRevenue: this.calculateTotalRevenue(orders),
          todaysOrders,
          weeklyGrowth: Math.round(weeklyGrowth * 100) / 100
        };
      })
    );
  }

  // ===== REVENUE ANALYTICS =====

  /**
   * Calculate revenue trends over time
   */
  getRevenueTrends(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Observable<Array<{
    period: string;
    revenue: number;
    orderCount: number;
    averageOrderValue: number;
  }>> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        const groupedOrders = this.groupOrdersByPeriod(orders, period);
        
        return Object.entries(groupedOrders)
          .map(([periodKey, periodOrders]) => ({
            period: periodKey,
            revenue: this.calculateTotalRevenue(periodOrders),
            orderCount: periodOrders.length,
            averageOrderValue: this.calculateAverageOrderValue(periodOrders)
          }))
          .sort((a, b) => a.period.localeCompare(b.period));
      })
    );
  }

  /**
   * Get revenue by status breakdown
   */
  getRevenueByStatus(): Observable<{ [status: string]: number }> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        return orders.reduce((acc, order) => {
          if (!acc[order.status]) {
            acc[order.status] = 0;
          }
          acc[order.status] += order.total_amount;
          return acc;
        }, {} as { [status: string]: number });
      })
    );
  }

  // ===== PRODUCT ANALYTICS =====

  /**
   * Get top-selling products
   */
  getTopProducts(limit: number = 10): Observable<ProductAnalytics[]> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        const productStats: { [productId: number]: ProductAnalytics } = {};

        orders.forEach(order => {
          order.order_items?.forEach(item => {
            if (!productStats[item.product_id]) {
              productStats[item.product_id] = {
                productId: item.product_id,
                productName: item.product?.name || 'Unknown Product',
                quantity: 0,
                revenue: 0,
                orderCount: 0
              };
            }

            productStats[item.product_id].quantity += item.quantity;
            productStats[item.product_id].revenue += item.total_price;
            productStats[item.product_id].orderCount++;
          });
        });

        return Object.values(productStats)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limit);
      })
    );
  }

  /**
   * Get product performance over time
   */
  getProductPerformance(productId: number): Observable<{
    totalSold: number;
    totalRevenue: number;
    averagePrice: number;
    monthlyTrends: Array<{
      month: string;
      quantity: number;
      revenue: number;
    }>;
  }> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        const productOrders = orders.filter(order => 
          order.order_items?.some(item => item.product_id === productId)
        );

        let totalSold = 0;
        let totalRevenue = 0;
        const monthlyData: { [month: string]: { quantity: number; revenue: number } } = {};

        productOrders.forEach(order => {
          const month = order.order_date.substring(0, 7); // YYYY-MM format
          if (!monthlyData[month]) {
            monthlyData[month] = { quantity: 0, revenue: 0 };
          }

          order.order_items?.forEach(item => {
            if (item.product_id === productId) {
              totalSold += item.quantity;
              totalRevenue += item.total_price;
              monthlyData[month].quantity += item.quantity;
              monthlyData[month].revenue += item.total_price;
            }
          });
        });

        const monthlyTrends = Object.entries(monthlyData)
          .map(([month, data]) => ({ month, ...data }))
          .sort((a, b) => a.month.localeCompare(b.month));

        return {
          totalSold,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averagePrice: totalSold > 0 ? Math.round((totalRevenue / totalSold) * 100) / 100 : 0,
          monthlyTrends
        };
      })
    );
  }

  // ===== CUSTOMER ANALYTICS =====

  /**
   * Get customer segments based on order behavior
   */
  getCustomerSegments(): Observable<CustomerSegment[]> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        const customerData: { [customerId: number]: { orderCount: number; totalSpent: number } } = {};

        orders.forEach(order => {
          if (!customerData[order.user_id]) {
            customerData[order.user_id] = { orderCount: 0, totalSpent: 0 };
          }
          customerData[order.user_id].orderCount++;
          customerData[order.user_id].totalSpent += order.total_amount;
        });

        const segments: CustomerSegment[] = [
          { segment: 'New Customers', orderCount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0 },
          { segment: 'Regular Customers', orderCount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0 },
          { segment: 'VIP Customers', orderCount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0 }
        ];

        Object.values(customerData).forEach(customer => {
          let segmentIndex = 0; // New customers (1 order)
          
          if (customer.orderCount >= 5 || customer.totalSpent >= 1000) {
            segmentIndex = 2; // VIP
          } else if (customer.orderCount >= 2) {
            segmentIndex = 1; // Regular
          }

          segments[segmentIndex].customerCount++;
          segments[segmentIndex].orderCount += customer.orderCount;
          segments[segmentIndex].revenue += customer.totalSpent;
        });

        // Calculate average order values
        segments.forEach(segment => {
          segment.averageOrderValue = segment.orderCount > 0 
            ? Math.round((segment.revenue / segment.orderCount) * 100) / 100 
            : 0;
          segment.revenue = Math.round(segment.revenue * 100) / 100;
        });

        return segments;
      })
    );
  }

  // ===== PERFORMANCE METRICS =====

  /**
   * Calculate order fulfillment metrics
   */
  getFulfillmentMetrics(): Observable<{
    averageProcessingTime: number;
    onTimeDeliveryRate: number;
    cancellationRate: number;
    returnRate: number;
  }> {
    return this.orderCache.orders$.pipe(
      map(orders => {
        let totalProcessingTime = 0;
        let processedOrders = 0;
        let onTimeDeliveries = 0;
        let deliveredOrders = 0;

        const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
        const returnedOrders = orders.filter(o => o.status === 'returned').length;

        orders.forEach(order => {
          // Calculate processing time (mock calculation)
          if (['shipped', 'delivered'].includes(order.status)) {
            const orderDate = new Date(order.order_date);
            const shippedDate = new Date(orderDate.getTime() + 2 * 24 * 60 * 60 * 1000); // Mock: 2 days processing
            totalProcessingTime += 2; // Mock: 2 days average
            processedOrders++;
          }

          // Calculate on-time delivery (mock calculation)
          if (order.status === 'delivered') {
            deliveredOrders++;
            // Mock: 90% on-time delivery rate
            if (Math.random() > 0.1) {
              onTimeDeliveries++;
            }
          }
        });

        return {
          averageProcessingTime: processedOrders > 0 ? totalProcessingTime / processedOrders : 0,
          onTimeDeliveryRate: deliveredOrders > 0 ? (onTimeDeliveries / deliveredOrders) * 100 : 0,
          cancellationRate: orders.length > 0 ? (cancelledOrders / orders.length) * 100 : 0,
          returnRate: orders.length > 0 ? (returnedOrders / orders.length) * 100 : 0
        };
      })
    );
  }

  // ===== PRIVATE HELPER METHODS =====

  private calculateComprehensiveAnalytics(orders: OrderModel[]): AnalyticsMetrics {
    const totalOrders = orders.length;
    const totalRevenue = this.calculateTotalRevenue(orders);
    const averageOrderValue = this.calculateAverageOrderValue(orders);

    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as { [status: string]: number });

    const revenueByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + order.total_amount;
      return acc;
    }, {} as { [status: string]: number });

    const monthlyTrends = this.calculateMonthlyTrends(orders);
    const topProducts = this.calculateTopProducts(orders);
    const customerSegments = this.calculateCustomerSegments(orders);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      conversionRate: 85, // Mock conversion rate
      ordersByStatus,
      revenueByStatus,
      monthlyTrends,
      topProducts,
      customerSegments
    };
  }

  private calculateTotalRevenue(orders: OrderModel[]): number {
    const revenue = orders
      .filter(order => !['cancelled', 'refunded'].includes(order.status))
      .reduce((total, order) => total + order.total_amount, 0);
    
    return Math.round(revenue * 100) / 100;
  }

  private calculateAverageOrderValue(orders: OrderModel[]): number {
    if (orders.length === 0) return 0;
    const totalRevenue = this.calculateTotalRevenue(orders);
    return Math.round((totalRevenue / orders.length) * 100) / 100;
  }

  private calculateMonthlyTrends(orders: OrderModel[]): MonthlyTrend[] {
    const monthlyData: { [month: string]: OrderModel[] } = {};
    
    orders.forEach(order => {
      const month = order.order_date.substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(order);
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    
    return sortedMonths.map((month, index) => {
      const monthOrders = monthlyData[month];
      const orderCount = monthOrders.length;
      const revenue = this.calculateTotalRevenue(monthOrders);
      const averageOrderValue = this.calculateAverageOrderValue(monthOrders);
      
      let growthRate = 0;
      if (index > 0) {
        const prevMonth = sortedMonths[index - 1];
        const prevRevenue = this.calculateTotalRevenue(monthlyData[prevMonth]);
        growthRate = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      }

      return {
        month,
        orderCount,
        revenue,
        averageOrderValue,
        growthRate: Math.round(growthRate * 100) / 100
      };
    });
  }

  private calculateTopProducts(orders: OrderModel[], limit: number = 5): ProductAnalytics[] {
    const productStats: { [productId: number]: ProductAnalytics } = {};

    orders.forEach(order => {
      order.order_items?.forEach(item => {
        if (!productStats[item.product_id]) {
          productStats[item.product_id] = {
            productId: item.product_id,
            productName: item.product?.name || 'Unknown Product',
            quantity: 0,
            revenue: 0,
            orderCount: 0
          };
        }

        productStats[item.product_id].quantity += item.quantity;
        productStats[item.product_id].revenue += item.total_price;
        productStats[item.product_id].orderCount++;
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  private calculateCustomerSegments(orders: OrderModel[]): CustomerSegment[] {
    const customerData: { [customerId: number]: { orderCount: number; totalSpent: number } } = {};

    orders.forEach(order => {
      if (!customerData[order.user_id]) {
        customerData[order.user_id] = { orderCount: 0, totalSpent: 0 };
      }
      customerData[order.user_id].orderCount++;
      customerData[order.user_id].totalSpent += order.total_amount;
    });

    const segments: CustomerSegment[] = [
      { segment: 'New', orderCount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0 },
      { segment: 'Regular', orderCount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0 },
      { segment: 'VIP', orderCount: 0, revenue: 0, customerCount: 0, averageOrderValue: 0 }
    ];

    Object.values(customerData).forEach(customer => {
      let segmentIndex = 0;
      
      if (customer.orderCount >= 5 || customer.totalSpent >= 1000) {
        segmentIndex = 2; // VIP
      } else if (customer.orderCount >= 2) {
        segmentIndex = 1; // Regular
      }

      segments[segmentIndex].customerCount++;
      segments[segmentIndex].orderCount += customer.orderCount;
      segments[segmentIndex].revenue += customer.totalSpent;
    });

    segments.forEach(segment => {
      segment.averageOrderValue = segment.orderCount > 0 
        ? Math.round((segment.revenue / segment.orderCount) * 100) / 100 
        : 0;
      segment.revenue = Math.round(segment.revenue * 100) / 100;
    });

    return segments;
  }

  private groupOrdersByPeriod(orders: OrderModel[], period: 'daily' | 'weekly' | 'monthly'): { [key: string]: OrderModel[] } {
    return orders.reduce((acc, order) => {
      let key: string;
      const date = new Date(order.order_date);

      switch (period) {
        case 'daily':
          key = order.order_date.split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = startOfWeek.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = order.order_date.substring(0, 7); // YYYY-MM
          break;
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(order);
      return acc;
    }, {} as { [key: string]: OrderModel[] });
  }

  private filterAnalyticsByTimeRange(analytics: AnalyticsMetrics, timeRange: TimeRangeFilter): AnalyticsMetrics {
    // This would filter the analytics based on the time range
    // For simplicity, returning the original analytics
    return analytics;
  }

  // ===== PUBLIC UTILITY METHODS =====

  /**
   * Export analytics data
   */
  exportAnalyticsData(): Observable<any> {
    return this.getOrderAnalytics().pipe(
      map(analytics => ({
        generated_at: new Date().toISOString(),
        ...analytics
      }))
    );
  }

  /**
   * Get analytics summary for dashboard
   */
  getDashboardSummary(): Observable<{
    totalOrders: number;
    totalRevenue: string;
    averageOrderValue: string;
    topPerformingMonth: string;
    growthRate: number;
  }> {
    return this.getOrderAnalytics().pipe(
      map(analytics => {
        const bestMonth = analytics.monthlyTrends.reduce((best, current) => 
          current.revenue > best.revenue ? current : best
        );

        const latestGrowth = analytics.monthlyTrends.length > 0 
          ? analytics.monthlyTrends[analytics.monthlyTrends.length - 1].growthRate 
          : 0;

        return {
          totalOrders: analytics.totalOrders,
          totalRevenue: this.formatCurrency(analytics.totalRevenue),
          averageOrderValue: this.formatCurrency(analytics.averageOrderValue),
          topPerformingMonth: bestMonth.month,
          growthRate: latestGrowth
        };
      })
    );
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
}