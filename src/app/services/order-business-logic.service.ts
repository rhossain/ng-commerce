// services/order-business-logic.service.ts - UPDATED FOR DEVELOPMENT MODE
import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { map, switchMap, catchError, tap, delay } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { OrderRepositoryService } from './order-repository.service';
import { PricingService } from './pricing.service';
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderItemRequest,
  OrderStatus,
  PaymentRequest,
  PaymentModel,
  UpdateOrderRequest,
  PromotionModel,
  ReturnRequest,
  InvoiceModel,
  OrderAnalytics,
  OrderTrackingEvent
} from '../models/order.model';

// Environment flag for development mode
const IS_DEVELOPMENT = true; // Set this to false for production

@Injectable({
  providedIn: 'root'
})
export class OrderBusinessLogicService {
  
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
      is_active: true
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
      is_active: true
    },
    {
      id: 3,
      created_at: Date.now(),
      code: 'FREESHIP',
      description: 'Free shipping on all orders',
      discount_type: 'free_shipping',
      discount_value: 0,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: undefined,
      usage_count: 0,
      is_active: true
    },
    {
      id: 4,
      created_at: Date.now(),
      code: 'WELCOME25',
      description: '$25 off orders over $75',
      discount_type: 'fixed_amount',
      discount_value: 25,
      minimum_order_amount: 75,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      usage_limit: 100,
      usage_count: 0,
      is_active: true
    }
  ];

  constructor(
    private orderRepository: OrderRepositoryService,
    private toastr: ToastrService,
    private pricingService: PricingService,
    private authService: AuthService,
    private router: Router
  ) {}

  // ===== ORDER CREATION LOGIC =====

  createOrder(orderData: CreateOrderRequest): Observable<OrderModel> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User must be logged in to create orders'));
    }

    if (!this.validateOrderData(orderData)) {
      return throwError(() => new Error('Invalid order data'));
    }

    const subtotal = this.calculateSubtotal(orderData.items);
    const orderPayload = {
      order_date: new Date().toISOString(),
      total_amount: subtotal,
      status: 'pending' as OrderStatus,
      cart_item_id: null,
      shipping_methods_id: orderData.shipping_method_id!,
      shipping_cost: 0,
      shipping_addresses_id: orderData.shipping_address_id!,
      notes: orderData.notes || '',
      user_id: userId
    };

    return this.orderRepository.createOrder(orderPayload).pipe(
      switchMap((createdOrder: OrderModel) => {
        if (!createdOrder || !createdOrder.id) {
          throw new Error('Order creation failed - no order ID returned');
        }

        return this.orderRepository.createOrderItems(createdOrder.id, orderData.items).pipe(
          map((orderItems) => ({
            ...createdOrder,
            order_items: orderItems
          })),
          catchError((itemsError) => {
            return this.orderRepository.deleteOrder(createdOrder.id).pipe(
              switchMap(() => throwError(() => new Error(`Order cancelled: ${itemsError.message}`)))
            );
          })
        );
      }),
      tap(() => {
        this.toastr.success('Order placed successfully!', 'Success');
      }),
      catchError(error => {
        let errorMessage = 'Failed to create order. Please try again.';
        if (error.status === 400) {
          errorMessage = error.error?.message || 'Invalid order data. Please check your information.';
        } else if (error.status === 401) {
          errorMessage = 'Please log in to place an order.';
          this.router.navigate(['/login']);
        } else if (error.message?.includes('Order cancelled:')) {
          errorMessage = 'Order creation was cancelled due to an error.';
        }
        
        this.toastr.error(errorMessage, 'Order Creation Failed');
        return throwError(() => error);
      })
    );
  }

  // ===== ORDER VALIDATION =====

  private validateOrderData(orderData: CreateOrderRequest): boolean {
    if (!orderData.shipping_address_id || !orderData.shipping_method_id) {
      this.toastr.error('Shipping address and method are required', 'Validation Error');
      return false;
    }

    if (!orderData.items || orderData.items.length === 0) {
      this.toastr.error('Order must contain at least one item', 'Validation Error');
      return false;
    }

    for (const item of orderData.items) {
      if (!item.product_id || !item.product_variant_id || item.quantity <= 0 || item.unit_price <= 0) {
        this.toastr.error('Invalid item data in order', 'Validation Error');
        return false;
      }
    }

    return true;
  }

  // ===== ORDER CANCELLATION LOGIC =====

  cancelOrder(orderId: number, reason?: string): Observable<OrderModel> {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.router.navigate(['/login']);
      return throwError(() => new Error('User not authenticated'));
    }

    return this.orderRepository.getOrderById(orderId).pipe(
      switchMap(order => {
        if (order.user_id !== userId) {
          throw new Error('Access denied: Order does not belong to current user');
        }

        if (!this.canCancelOrder(order)) {
          throw new Error('Order cannot be cancelled. Current status: ' + order.status);
        }

        const updates: UpdateOrderRequest = {
          status: 'cancelled' as OrderStatus,
          notes: reason ? `${order.notes}\nCancelled by customer: ${reason}` : `${order.notes}\nCancelled by customer`,
          user_id: userId
        };
        
        return this.orderRepository.updateOrder(orderId, updates);
      }),
      tap(() => {
        this.toastr.success('Order cancelled successfully', 'Success');
      }),
      catchError(error => {
        console.error('Order cancellation failed:', error);
        this.toastr.error(error.message || 'Failed to cancel order', 'Cancellation Failed');
        return throwError(() => error);
      })
    );
  }

  // ===== DEVELOPMENT MODE PAYMENT PROCESSING =====

  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    if (!this.validatePaymentData(paymentData)) {
      return throwError(() => new Error('Invalid payment data'));
    }

    if (IS_DEVELOPMENT) {
      return this.processMockPayment(paymentData);
    }

    // Production payment processing
    return this.orderRepository.processPayment(paymentData).pipe(
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
   * DEVELOPMENT MODE: Process mock payment for testing
   */
  private processMockPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    console.log('Processing mock payment in development mode:', paymentData);

    // Simulate network delay
    return of(null).pipe(
      delay(1500), // 1.5 second delay to simulate API call
      map(() => {
        // Create mock payment response
        const mockPayment: PaymentModel = {
          id: Date.now(), // Mock ID
          created_at: Date.now(),
          amount: paymentData.amount,
          payment_method: paymentData.payment_method,
          status: 'completed', // Always succeed in development
          order_id: paymentData.order_id,
          transaction_id: `DEV_TXN_${Date.now()}`,
          gateway_response: {
            status: 'success',
            transaction_id: `DEV_TXN_${Date.now()}`,
            gateway: 'development',
            processed_at: new Date().toISOString()
          },
          currency: paymentData.currency || 'USD'
        };

        console.log('Mock payment created:', mockPayment);
        return mockPayment;
      }),
      tap(payment => {
        this.toastr.success(`Mock payment processed successfully (${payment.payment_method})`, 'Development Mode');
      }),
      catchError(error => {
        console.error('Mock payment failed:', error);
        this.toastr.error('Mock payment failed', 'Development Error');
        return throwError(() => error);
      })
    );
  }

  private validatePaymentData(paymentData: PaymentRequest): boolean {
    if (!paymentData.order_id || !paymentData.payment_method || paymentData.amount <= 0) {
      this.toastr.error('Invalid payment information', 'Validation Error');
      return false;
    }
    return true;
  }

  // ===== PROMOTION LOGIC =====

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
      return throwError(() => ({ status: 400, message: 'This promotion is not currently active' }));
    }

    if (promotion.minimum_order_amount && orderTotal < promotion.minimum_order_amount) {
      this.toastr.error(`Minimum order amount of ${promotion.minimum_order_amount} required`, 'Error');
      return throwError(() => ({ status: 400, message: `Minimum order amount of ${promotion.minimum_order_amount} required` }));
    }

    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      this.toastr.error('This promotion has reached its usage limit', 'Error');
      return throwError(() => ({ status: 400, message: 'This promotion has reached its usage limit' }));
    }

    this.toastr.success(`Promotion "${promotion.code}" applied!`, 'Success');
    return of(promotion);
  }

  calculateDiscount(promotion: PromotionModel, orderTotal: number): number {
    let discount = 0;
    
    if (promotion.discount_type === 'percentage') {
      discount = (orderTotal * promotion.discount_value) / 100;
      if (promotion.maximum_discount_amount && discount > promotion.maximum_discount_amount) {
        discount = promotion.maximum_discount_amount;
      }
    } else if (promotion.discount_type === 'fixed_amount') {
      discount = Math.min(promotion.discount_value, orderTotal);
    }
    
    return Math.round(discount * 100) / 100;
  }

  usePromotion(code: string): void {
    const promotion = this.mockPromotions.find(p => 
      p.code.toLowerCase() === code.toLowerCase().trim()
    );
    
    if (promotion) {
      promotion.usage_count++;
    }
  }

  getAvailablePromotions(): PromotionModel[] {
    return this.mockPromotions.filter(p => p.is_active);
  }

  // ===== CALCULATION METHODS =====

  calculateSubtotal(items: { unit_price: number; quantity: number }[]): number {
    return items.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  }

  calculateOrderTotal(
    cartSubtotal: number, 
    shippingCost: number, 
    taxRate: number = 0, 
    promotion?: PromotionModel | null
  ): {
    total: number;
    tax: number;
    discount: number;
    shipping: number;
  } {
    let discount = 0;
    let finalShippingCost = shippingCost;

    if (promotion) {
      if (promotion.discount_type === 'free_shipping') {
        finalShippingCost = 0;
      } else {
        discount = this.calculateDiscount(promotion, cartSubtotal);
      }
    }

    const tax = Math.round(cartSubtotal * taxRate * 100) / 100;
    const total = Math.max(0, cartSubtotal + finalShippingCost + tax - discount);

    return {
      total: Math.round(total * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      shipping: Math.round(finalShippingCost * 100) / 100
    };
  }

  // ===== BUSINESS RULE METHODS =====

  canCancelOrder(order: OrderModel): boolean {
    return ['pending', 'confirmed'].includes(order.status);
  }

  canReturnOrder(order: OrderModel): boolean {
    if (order.status !== 'delivered') return false;
    
    const deliveredDate = new Date(order.shipping_status?.actual_delivery_date || order.order_date);
    const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = new Date();
    
    return (now.getTime() - deliveredDate.getTime()) <= returnWindow;
  }

  canReorderOrder(order: OrderModel): boolean {
    return ['delivered', 'cancelled'].includes(order.status);
  }

  requiresSignature(order: OrderModel): boolean {
    return order.total_amount > 500;
  }

  isEligibleForExpeditedShipping(order: OrderModel): boolean {
    return order.total_amount > 100;
  }

  qualifiesForFreeShipping(order: OrderModel, promotion?: PromotionModel): boolean {
    if (promotion && promotion.discount_type === 'free_shipping') {
      return true;
    }
    return order.total_amount >= 75;
  }

  getOrderPriority(order: OrderModel): 'low' | 'normal' | 'high' | 'urgent' {
    if (order.total_amount > 1000) return 'urgent';
    if (order.total_amount > 500) return 'high';
    if (order.total_amount > 100) return 'normal';
    return 'low';
  }

  getEstimatedDeliveryDate(order: OrderModel): Date | null {
    if (!order.shipping_method) return null;
    
    const orderDate = new Date(order.order_date);
    const deliveryDays = parseInt(order.shipping_method.estimated_delivery_days) || 7;
    
    const estimatedDate = new Date(orderDate);
    estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
    
    return estimatedDate;
  }

  isOverdueForShipping(order: OrderModel): boolean {
    if (order.status !== 'processing') return false;
    
    const orderDate = new Date(order.order_date);
    const maxProcessingDays = 2;
    const cutoffDate = new Date(orderDate);
    cutoffDate.setDate(cutoffDate.getDate() + maxProcessingDays);
    
    return new Date() > cutoffDate;
  }

  needsAttention(order: OrderModel): { needsAttention: boolean; reason?: string } {
    if (this.isOverdueForShipping(order)) {
      return { needsAttention: true, reason: 'Order is overdue for shipping' };
    }

    if (order.payment && order.payment.status === 'failed') {
      return { needsAttention: true, reason: 'Payment failed' };
    }

    if (order.payment && order.payment.status === 'pending') {
      const paymentAge = new Date().getTime() - order.created_at;
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (paymentAge > oneDayMs) {
        return { needsAttention: true, reason: 'Payment pending for over 24 hours' };
      }
    }

    return { needsAttention: false };
  }

  // ===== RETURN AND REFUND LOGIC =====

  createReturnRequest(returnData: Partial<ReturnRequest>): Observable<ReturnRequest> {
    // Mock implementation for development
    const mockReturn: ReturnRequest = {
      id: Date.now(),
      order_id: returnData.order_id || 0,
      order_item_id: returnData.order_item_id || 0,
      reason: returnData.reason || '',
      status: 'pending',
      requested_date: new Date().toISOString(),
      refund_amount: returnData.refund_amount || 0
    };

    return of(mockReturn).pipe(
      delay(500), // Simulate API delay
      tap(() => {
        this.toastr.success('Return request submitted successfully', 'Success');
      })
    );
  }

  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    if (IS_DEVELOPMENT) {
      // Mock refund processing
      const mockRefund: PaymentModel = {
        id: Date.now(),
        created_at: Date.now(),
        amount: -amount, // Negative for refund
        payment_method: 'refund',
        status: 'completed',
        order_id: 0, // Would be populated in real implementation
        transaction_id: `REF_${Date.now()}`,
        refund_amount: amount,
        refund_date: new Date().toISOString(),
        currency: 'USD'
      };

      return of(mockRefund).pipe(
        delay(1000),
        tap(() => {
          this.toastr.success(`Refund of ${amount} processed successfully`, 'Development Mode');
        })
      );
    }

    return this.orderRepository.processRefund(paymentId, amount, reason);
  }

  // ===== ANALYTICS =====

  calculateOrderAnalytics(orders: OrderModel[]): OrderAnalytics {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as { [key in OrderStatus]: number });

    return {
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      average_order_value: averageOrderValue,
      orders_by_status: ordersByStatus,
      orders_by_month: [],
      top_products: [],
      top_shipping_methods: []
    };
  }

  // ===== INVOICE GENERATION =====

  generateInvoice(orderId: number): Observable<InvoiceModel> {
    return this.orderRepository.getOrderWithRelations(orderId).pipe(
      map(order => {
        const subtotal = order.order_items?.reduce((sum, item) => sum + item.total_price, 0) || 0;
        const tax = this.calculateTaxAmount(order, 0.08); // 8% tax rate
        const shipping = order.shipping_cost || 0;
        const discount = order.discount_amount || 0;

        const invoice: InvoiceModel = {
          id: Date.now(),
          order_id: orderId,
          invoice_number: `INV-${orderId}-${Date.now()}`,
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'sent',
          subtotal: subtotal,
          tax_amount: tax,
          shipping_cost: shipping,
          discount_amount: discount,
          total_amount: order.total_amount,
          currency: 'USD',
          order: order
        };

        return invoice;
      }),
      tap(() => {
        this.toastr.success('Invoice generated successfully', 'Success');
      })
    );
  }

  downloadInvoice(orderId: number): Observable<Blob> {
    return this.orderRepository.getOrderWithRelations(orderId).pipe(
      map(order => {
        const invoiceContent = this.generateInvoiceContent(order);
        return new Blob([invoiceContent], { type: 'text/plain;charset=utf-8' });
      }),
      delay(300),
      tap(() => {
        this.toastr.success('Invoice download ready', 'Success');
      })
    );
  }

  private generateInvoiceContent(order: OrderModel): string {
    const subtotal = order.order_items?.reduce((sum, item) => sum + item.total_price, 0) || 0;
    const tax = this.calculateTaxAmount(order, 0.08);
    const shipping = order.shipping_cost || 0;
    const discount = order.discount_amount || 0;

    const content = `
================================================================================
                                   INVOICE
================================================================================

Invoice Number: INV-${order.id}-${Date.now()}
Order Number: #${order.id}
Invoice Date: ${new Date().toLocaleDateString()}
Order Date: ${new Date(order.order_date).toLocaleDateString()}

================================================================================
                              CUSTOMER INFORMATION
================================================================================

${this.getCustomerInfo(order)}

================================================================================
                              SHIPPING INFORMATION
================================================================================

${this.getShippingInfo(order)}

================================================================================
                                ORDER ITEMS
================================================================================

${this.getItemsSection(order)}

================================================================================
                               ORDER SUMMARY
================================================================================

Subtotal:           ${this.formatCurrency(subtotal)}
${shipping > 0 ? `Shipping:           ${this.formatCurrency(shipping)}` : 'Shipping:           FREE'}
${discount > 0 ? `Discount:          -${this.formatCurrency(discount)}` : ''}
Tax (8%):           ${this.formatCurrency(tax)}
--------------------------------------------------------------------------------
TOTAL:              ${this.formatCurrency(order.total_amount)}

================================================================================
                               PAYMENT INFORMATION
================================================================================

${this.getPaymentInfo(order)}

================================================================================
                               ORDER STATUS
================================================================================

Status: ${this.getOrderStatusText(order.status)}
${order.shipping_status?.tracking_number ? `Tracking Number: ${order.shipping_status.tracking_number}` : ''}
${order.shipping_status?.estimated_delivery ? `Estimated Delivery: ${order.shipping_status.estimated_delivery}` : ''}

================================================================================

Thank you for your business!

For questions about this invoice, please contact our customer service team.
Email: support@yourstore.com
Phone: 1-800-555-0123

================================================================================
    `;

    return content.trim();
  }

  private getCustomerInfo(order: OrderModel): string {
    const address = order.shipping_address;
    if (!address) {
      return 'Customer information not available';
    }

    return `
Customer: ${address.first_name} ${address.last_name}
${address.company ? `Company: ${address.company}` : ''}
Email: ${order.user?.email || 'Not provided'}
Phone: ${address.phone || 'Not provided'}
    `.trim();
  }

  private getShippingInfo(order: OrderModel): string {
    const address = order.shipping_address;
    if (!address) {
      return 'Shipping information not available';
    }

    return `
Shipping Address:
${address.first_name} ${address.last_name}
${address.company ? `${address.company}` : ''}
${address.address_line_1}
${address.address_line_2 ? `${address.address_line_2}` : ''}
${address.city}, ${address.state} ${address.zip_code}
${address.country}

Shipping Method: ${order.shipping_method?.name || 'Standard Shipping'}
${address.delivery_instructions ? `Delivery Instructions: ${address.delivery_instructions}` : ''}
    `.trim();
  }

  private getItemsSection(order: OrderModel): string {
    if (!order.order_items || order.order_items.length === 0) {
      return 'No items found';
    }

    let itemsText = 'Item                                    Qty    Unit Price    Total\n';
    itemsText += '------------------------------------------------------------------------\n';

    order.order_items.forEach(item => {
      const name = (item.product?.name || 'Unknown Product').substring(0, 35);
      const paddedName = name.padEnd(35);
      const qty = item.quantity.toString().padStart(6);
      const unitPrice = this.formatCurrency(item.unit_price).padStart(12);
      const totalPrice = this.formatCurrency(item.total_price).padStart(10);
      
      itemsText += `${paddedName} ${qty} ${unitPrice} ${totalPrice}\n`;
      
      if (item.variant?.sku) {
        itemsText += `  SKU: ${item.variant.sku}\n`;
      }
      if (item.product?.brand) {
        itemsText += `  Brand: ${item.product.brand}\n`;
      }
      itemsText += '\n';
    });

    return itemsText;
  }

  private getPaymentInfo(order: OrderModel): string {
    if (!order.payment) {
      return 'Payment information not available';
    }

    return `
Payment Method: ${order.payment.payment_method}
Payment Status: ${order.payment.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
Amount Paid: ${this.formatCurrency(order.payment.amount)}
${order.payment.transaction_id ? `Transaction ID: ${order.payment.transaction_id}` : ''}
Payment Date: ${new Date(order.payment.created_at).toLocaleDateString()}
    `.trim();
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  private getOrderStatusText(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private calculateTaxAmount(order: OrderModel, taxRate: number): number {
    const subtotal = order.order_items?.reduce((sum, item) => sum + item.total_price, 0) || 0;
    return Math.round(subtotal * taxRate * 100) / 100;
  }
}