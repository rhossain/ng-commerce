// services/order-utility.service.ts - COMPLETE VERSION
import { Injectable } from '@angular/core';
import { OrderModel, OrderStatus } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderUtilityService {

  constructor() { }

  // ===== STATUS DISPLAY METHODS =====

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

  getOrderStatusIcon(status: OrderStatus): string {
    const iconMap: { [key in OrderStatus]: string } = {
      'pending': 'clock',
      'confirmed': 'check-circle',
      'processing': 'cog',
      'shipped': 'truck',
      'delivered': 'home',
      'cancelled': 'x-circle',
      'refunded': 'arrow-left-circle',
      'returned': 'rotate-ccw'
    };
    return iconMap[status] || 'circle';
  }

  getPaymentStatusText(order: OrderModel): string {
    if (!order.payment) return 'Pending';
    
    const status = order.payment.status;
    return status.replace(/_/g, ' ')
                 .replace(/\b\w/g, l => l.toUpperCase());
  }

  getShippingStatus(order: OrderModel): string {
    if (!order.shipping_status) return 'Pending';
    
    const status = order.shipping_status.status;
    return status.replace(/_/g, ' ')
                 .replace(/\b\w/g, l => l.toUpperCase());
  }

  // ===== FORMATTING METHODS =====

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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  formatOrderId(orderId: number): string {
    return `#${orderId.toString().padStart(6, '0')}`;
  }

  formatDateRange(startDate: string, endDate: string): string {
    const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  }

  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format US phone numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    // Format international numbers with country code
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    // Return original if we can't format it
    return phone;
  }

  // ===== ORDER CALCULATION METHODS =====

  getTotalItemsInOrder(order: OrderModel): number {
    return order.order_items?.reduce((total, item) => total + item.quantity, 0) || 0;
  }

  getOrderSubtotal(order: OrderModel): number {
    return order.order_items?.reduce((total, item) => total + item.total_price, 0) || 0;
  }

  getUniqueProductCount(order: OrderModel): number {
    if (!order.order_items) return 0;
    
    const uniqueProducts = new Set(order.order_items.map(item => item.product_id));
    return uniqueProducts.size;
  }

  calculateTaxAmount(order: OrderModel, taxRate: number = 0.08): number {
    const subtotal = this.getOrderSubtotal(order);
    return Math.round(subtotal * taxRate * 100) / 100;
  }

  calculateDiscountAmount(order: OrderModel): number {
    return order.discount_amount || 0;
  }

  calculateTotalSavings(order: OrderModel): number {
    const discounts = this.calculateDiscountAmount(order);
    const freeShipping = order.shipping_cost === 0 ? 10 : 0; // Assume $10 saved on free shipping
    return discounts + freeShipping;
  }

  // ===== ORDER INFORMATION METHODS =====

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

  getShippingMethodName(order: OrderModel): string {
    return order.shipping_method?.name || 'Standard Shipping';
  }

  getPaymentMethodName(order: OrderModel): string {
    return order.payment?.payment_method || 'Not specified';
  }

  getCustomerName(order: OrderModel): string {
    if (order.shipping_address) {
      return `${order.shipping_address.first_name} ${order.shipping_address.last_name}`.trim();
    }
    return order.user?.name || 'Unknown Customer';
  }

  getFormattedShippingAddress(order: OrderModel): string {
    const addr = order.shipping_address;
    if (!addr) return 'No address provided';
    
    const lines = [
      `${addr.first_name} ${addr.last_name}`.trim(),
      addr.company,
      addr.address_line_1,
      addr.address_line_2,
      `${addr.city}, ${addr.state} ${addr.zip_code}`,
      addr.country
    ].filter(Boolean);
    
    return lines.join('\n');
  }

  getFormattedShippingAddressOneLine(order: OrderModel): string {
    const addr = order.shipping_address;
    if (!addr) return 'No address provided';
    
    const parts = [
      addr.address_line_1,
      addr.city,
      addr.state,
      addr.zip_code
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  getOrderNotes(order: OrderModel): string {
    return order.notes || 'No notes';
  }

  // ===== ORDER STATUS AND TRACKING METHODS =====

  getEstimatedDeliveryDate(order: OrderModel): Date | null {
    if (!order.shipping_method) return null;
    
    const orderDate = new Date(order.order_date);
    const deliveryDays = parseInt(order.shipping_method.estimated_delivery_days) || 7;
    
    const estimatedDate = new Date(orderDate);
    estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
    
    return estimatedDate;
  }

  hasTrackingInfo(order: OrderModel): boolean {
    return !!(order.shipping_status?.tracking_number);
  }

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

  getOrderAgeInDays(order: OrderModel): number {
    const orderDate = new Date(order.order_date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - orderDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isRecentOrder(order: OrderModel): boolean {
    return this.getOrderAgeInDays(order) <= 7;
  }

  isOrderOverdue(order: OrderModel): boolean {
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) return false;
    
    const estimatedDelivery = this.getEstimatedDeliveryDate(order);
    if (!estimatedDelivery) return false;
    
    return new Date() > estimatedDelivery;
  }

  getDeliveryStatus(order: OrderModel): 'on-time' | 'delayed' | 'delivered' | 'unknown' {
    if (order.status === 'delivered') return 'delivered';
    
    const estimatedDelivery = this.getEstimatedDeliveryDate(order);
    if (!estimatedDelivery) return 'unknown';
    
    const now = new Date();
    const isOverdue = now > estimatedDelivery;
    
    return isOverdue ? 'delayed' : 'on-time';
  }

  // ===== ORDER VALIDATION METHODS =====

  validateOrderCompleteness(order: OrderModel): { isComplete: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    if (!order.shipping_addresses_id) missingFields.push('shipping_address');
    if (!order.shipping_methods_id) missingFields.push('shipping_method');
    if (!order.order_items || order.order_items.length === 0) missingFields.push('order_items');
    if (!order.payment) missingFields.push('payment');
    
    return {
      isComplete: missingFields.length === 0,
      missingFields
    };
  }

  validateOrderItems(order: OrderModel): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!order.order_items || order.order_items.length === 0) {
      errors.push('No items in order');
      return { isValid: false, errors };
    }
    
    order.order_items.forEach((item, index) => {
      if (!item.product_id) errors.push(`Item ${index + 1}: Missing product ID`);
      if (!item.product_variant_id) errors.push(`Item ${index + 1}: Missing variant ID`);
      if (item.quantity <= 0) errors.push(`Item ${index + 1}: Invalid quantity`);
      if (item.unit_price <= 0) errors.push(`Item ${index + 1}: Invalid price`);
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateShippingAddress(order: OrderModel): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const addr = order.shipping_address;
    
    if (!addr) {
      errors.push('No shipping address provided');
      return { isValid: false, errors };
    }
    
    if (!addr.first_name?.trim()) errors.push('First name is required');
    if (!addr.last_name?.trim()) errors.push('Last name is required');
    if (!addr.address_line_1?.trim()) errors.push('Street address is required');
    if (!addr.city?.trim()) errors.push('City is required');
    if (!addr.state?.trim()) errors.push('State is required');
    if (!addr.zip_code?.trim()) errors.push('ZIP code is required');
    if (!addr.country?.trim()) errors.push('Country is required');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ===== SORTING AND FILTERING HELPERS =====

  sortOrdersByDate(orders: OrderModel[], ascending: boolean = false): OrderModel[] {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.order_date).getTime();
      const dateB = new Date(b.order_date).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }

  sortOrdersByAmount(orders: OrderModel[], ascending: boolean = false): OrderModel[] {
    return [...orders].sort((a, b) => {
      return ascending ? a.total_amount - b.total_amount : b.total_amount - a.total_amount;
    });
  }

  sortOrdersByStatus(orders: OrderModel[]): OrderModel[] {
    const statusPriority = {
      'pending': 1,
      'confirmed': 2,
      'processing': 3,
      'shipped': 4,
      'delivered': 5,
      'cancelled': 6,
      'refunded': 7,
      'returned': 8
    };
    
    return [...orders].sort((a, b) => {
      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;
      return priorityA - priorityB;
    });
  }

  groupOrdersByStatus(orders: OrderModel[]): { [status: string]: OrderModel[] } {
    return orders.reduce((groups, order) => {
      const status = order.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(order);
      return groups;
    }, {} as { [status: string]: OrderModel[] });
  }

  groupOrdersByMonth(orders: OrderModel[]): { [month: string]: OrderModel[] } {
    return orders.reduce((groups, order) => {
      const date = new Date(order.order_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(order);
      return groups;
    }, {} as { [month: string]: OrderModel[] });
  }

  groupOrdersByCustomer(orders: OrderModel[]): { [customerId: number]: OrderModel[] } {
    return orders.reduce((groups, order) => {
      const customerId = order.user_id;
      if (!groups[customerId]) {
        groups[customerId] = [];
      }
      groups[customerId].push(order);
      return groups;
    }, {} as { [customerId: number]: OrderModel[] });
  }

  // ===== ANALYTICS HELPERS =====

  calculateAverageOrderValue(orders: OrderModel[]): number {
    if (orders.length === 0) return 0;
    
    const total = orders.reduce((sum, order) => sum + order.total_amount, 0);
    return Math.round((total / orders.length) * 100) / 100;
  }

  getOrderCountByStatus(orders: OrderModel[]): { [status: string]: number } {
    return orders.reduce((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {} as { [status: string]: number });
  }

  calculateTotalRevenue(orders: OrderModel[]): number {
    return orders
      .filter(order => !['cancelled', 'refunded'].includes(order.status))
      .reduce((total, order) => total + order.total_amount, 0);
  }

  getMostPopularProducts(orders: OrderModel[], limit: number = 10): Array<{ productId: number; productName: string; quantity: number }> {
    const productCounts: { [productId: number]: { name: string; quantity: number } } = {};
    
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        if (!productCounts[item.product_id]) {
          productCounts[item.product_id] = {
            name: item.product?.name || 'Unknown Product',
            quantity: 0
          };
        }
        productCounts[item.product_id].quantity += item.quantity;
      });
    });
    
    return Object.entries(productCounts)
      .map(([productId, data]) => ({
        productId: parseInt(productId),
        productName: data.name,
        quantity: data.quantity
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  getTopCustomers(orders: OrderModel[], limit: number = 10): Array<{ customerId: number; customerName: string; orderCount: number; totalSpent: number }> {
    const customerData: { [customerId: number]: { name: string; orderCount: number; totalSpent: number } } = {};
    
    orders.forEach(order => {
      if (!customerData[order.user_id]) {
        customerData[order.user_id] = {
          name: this.getCustomerName(order),
          orderCount: 0,
          totalSpent: 0
        };
      }
      customerData[order.user_id].orderCount++;
      customerData[order.user_id].totalSpent += order.total_amount;
    });
    
    return Object.entries(customerData)
      .map(([customerId, data]) => ({
        customerId: parseInt(customerId),
        customerName: data.name,
        orderCount: data.orderCount,
        totalSpent: data.totalSpent
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  }

  calculateMonthlyGrowth(orders: OrderModel[]): Array<{ month: string; orderCount: number; revenue: number; growth: number }> {
    const monthlyData = this.groupOrdersByMonth(orders);
    const months = Object.keys(monthlyData).sort();
    
    return months.map((month, index) => {
      const monthOrders = monthlyData[month];
      const orderCount = monthOrders.length;
      const revenue = monthOrders.reduce((sum, order) => sum + order.total_amount, 0);
      
      let growth = 0;
      if (index > 0) {
        const prevMonth = months[index - 1];
        const prevRevenue = monthlyData[prevMonth].reduce((sum, order) => sum + order.total_amount, 0);
        growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
      }
      
      return {
        month,
        orderCount,
        revenue: Math.round(revenue * 100) / 100,
        growth: Math.round(growth * 100) / 100
      };
    });
  }

  // ===== UTILITY HELPERS =====

  cloneOrder(order: OrderModel): OrderModel {
    return JSON.parse(JSON.stringify(order));
  }

  compareOrders(order1: OrderModel, order2: OrderModel): boolean {
    return JSON.stringify(order1) === JSON.stringify(order2);
  }

  extractOrderIds(orders: OrderModel[]): number[] {
    return orders.map(order => order.id);
  }

  matchesSearchCriteria(order: OrderModel, searchTerm: string): boolean {
    const term = searchTerm.toLowerCase();
    
    return order.id.toString().includes(term) ||
           order.notes.toLowerCase().includes(term) ||
           order.status.toLowerCase().includes(term) ||
           this.getCustomerName(order).toLowerCase().includes(term) ||
           this.getProductNamesFromOrder(order).toLowerCase().includes(term) ||
           this.formatOrderId(order.id).toLowerCase().includes(term) ||
           this.formatCurrency(order.total_amount).toLowerCase().includes(term);
  }

  filterOrdersByDateRange(orders: OrderModel[], startDate: string, endDate: string): OrderModel[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return orders.filter(order => {
      const orderDate = new Date(order.order_date);
      return orderDate >= start && orderDate <= end;
    });
  }

  filterOrdersByAmountRange(orders: OrderModel[], minAmount: number, maxAmount: number): OrderModel[] {
    return orders.filter(order => 
      order.total_amount >= minAmount && order.total_amount <= maxAmount
    );
  }

  filterOrdersByStatus(orders: OrderModel[], statuses: OrderStatus[]): OrderModel[] {
    return orders.filter(order => statuses.includes(order.status));
  }

  filterOrdersByCustomer(orders: OrderModel[], customerId: number): OrderModel[] {
    return orders.filter(order => order.user_id === customerId);
  }

  // ===== EXPORT HELPERS =====

  prepareOrderForExport(order: OrderModel): any {
    return {
      order_id: this.formatOrderId(order.id),
      order_date: this.formatOrderDate(order.order_date),
      customer_name: this.getCustomerName(order),
      status: this.getOrderStatusText(order.status),
      items: this.getTotalItemsInOrder(order),
      subtotal: this.formatCurrency(this.getOrderSubtotal(order)),
      shipping: this.formatCurrency(order.shipping_cost),
      tax: this.formatCurrency(this.calculateTaxAmount(order)),
      total: this.formatCurrency(order.total_amount),
      shipping_method: this.getShippingMethodName(order),
      payment_method: this.getPaymentMethodName(order),
      shipping_address: this.getFormattedShippingAddressOneLine(order),
      tracking_number: order.shipping_status?.tracking_number || 'N/A',
      notes: this.getOrderNotes(order)
    };
  }

  convertOrdersToCSV(orders: OrderModel[]): string {
    if (orders.length === 0) return '';
    
    const exportedOrders = orders.map(order => this.prepareOrderForExport(order));
    const headers = Object.keys(exportedOrders[0]);
    
    const csvContent = [
      headers.join(','),
      ...exportedOrders.map(order =>
        headers.map(header => `"${order[header] || ''}"`).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }

  downloadCSV(orders: OrderModel[], filename: string = 'orders.csv'): void {
    const csvContent = this.convertOrdersToCSV(orders);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    if ((navigator as any).msSaveBlob) {
      (navigator as any).msSaveBlob(blob, filename);
    } else {
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }

  // ===== DEBUG AND DEVELOPMENT HELPERS =====

  debugOrder(order: OrderModel): void {
    console.group(`Order Debug: ${this.formatOrderId(order.id)}`);
    console.log('Status:', this.getOrderStatusText(order.status));
    console.log('Customer:', this.getCustomerName(order));
    console.log('Total Amount:', this.formatCurrency(order.total_amount));
    console.log('Items Count:', this.getTotalItemsInOrder(order));
    console.log('Order Age:', `${this.getOrderAgeInDays(order)} days`);
    console.log('Is Recent:', this.isRecentOrder(order));
    console.log('Has Tracking:', this.hasTrackingInfo(order));
    console.log('Delivery Status:', this.getDeliveryStatus(order));
    
    const validation = this.validateOrderCompleteness(order);
    console.log('Is Complete:', validation.isComplete);
    if (!validation.isComplete) {
      console.log('Missing Fields:', validation.missingFields);
    }
    
    console.groupEnd();
  }

  generateOrderSummaryReport(orders: OrderModel[]): any {
    const totalOrders = orders.length;
    const totalRevenue = this.calculateTotalRevenue(orders);
    const averageOrderValue = this.calculateAverageOrderValue(orders);
    const statusCounts = this.getOrderCountByStatus(orders);
    const topProducts = this.getMostPopularProducts(orders, 5);
    const topCustomers = this.getTopCustomers(orders, 5);
    const monthlyGrowth = this.calculateMonthlyGrowth(orders);
    
    return {
      summary: {
        total_orders: totalOrders,
        total_revenue: this.formatCurrency(totalRevenue),
        average_order_value: this.formatCurrency(averageOrderValue),
        date_range: totalOrders > 0 ? {
          earliest: this.formatOrderDate(orders[orders.length - 1].order_date),
          latest: this.formatOrderDate(orders[0].order_date)
        } : null
      },
      status_breakdown: Object.entries(statusCounts).map(([status, count]) => ({
        status: this.getOrderStatusText(status as OrderStatus),
        count,
        percentage: Math.round((count / totalOrders) * 100)
      })),
      top_products: topProducts,
      top_customers: topCustomers.map(customer => ({
        ...customer,
        totalSpent: this.formatCurrency(customer.totalSpent)
      })),
      monthly_growth: monthlyGrowth.map(month => ({
        ...month,
        revenue: this.formatCurrency(month.revenue)
      }))
    };
  }

  // ===== PERFORMANCE HELPERS =====

  measurePerformance<T>(fn: () => T, label: string): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[Performance] ${label}: ${end - start}ms`);
    return result;
  }

  optimizeOrdersArray(orders: OrderModel[]): OrderModel[] {
    // Remove duplicate orders and sort by ID for faster lookups
    const uniqueOrders = orders.filter((order, index, arr) => 
      arr.findIndex(o => o.id === order.id) === index
    );
    
    return uniqueOrders.sort((a, b) => a.id - b.id);
  }

  // ===== ACCESSIBILITY HELPERS =====

  getOrderStatusAriaLabel(order: OrderModel): string {
    const status = this.getOrderStatusText(order.status);
    const date = this.formatOrderDate(order.order_date);
    const amount = this.formatCurrency(order.total_amount);
    
    return `Order ${this.formatOrderId(order.id)}, ${status}, placed on ${date}, total ${amount}`;
  }

  getOrderActionAriaLabel(action: string, order: OrderModel): string {
    return `${action} order ${this.formatOrderId(order.id)} for ${this.getCustomerName(order)}`;
  }
}