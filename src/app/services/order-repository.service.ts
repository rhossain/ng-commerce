import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root'
})
export class OrderRepositoryService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.apiUrl = environment.apiBaseUrl;
  }

  // ===== ORDER OPERATIONS =====

  /**
   * Create a new order
   */
  createOrder(orderData: Omit<OrderModel, 'id' | 'created_at'>): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.createOrder}`;
    const headers = this.getAuthHeaders();
    
    return this.http.post<OrderModel>(url, orderData, { headers });
  }

  /**
   * Get all orders
   */
  getAllOrders(): Observable<OrderModel[]> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getUserOrders}`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<OrderModel[]>(url, { headers });
  }

  /**
   * Get order by ID
   */
  getOrderById(orderId: number): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.getOrder}/${orderId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<OrderModel>(url, { headers });
  }

  /**
   * Update order
   */
  updateOrder(orderId: number, updates: UpdateOrderRequest): Observable<OrderModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.updateOrderStatus}/${orderId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.patch<OrderModel>(url, updates, { headers });
  }

  /**
   * Delete order
   */
  deleteOrder(orderId: number): Observable<any> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.order.cancelOrder}/${orderId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.delete(url, { headers });
  }

  /**
   * Get orders for specific user
   */
  getOrdersByUserId(userId: number): Observable<OrderModel[]> {
    return this.getAllOrders().pipe(
      map(orders => orders.filter(order => order.user_id === userId))
    );
  }

  // ===== ORDER ITEM OPERATIONS =====

  /**
   * Create order item
   */
  createOrderItem(orderItemData: Omit<OrderItem, 'id' | 'created_at'>): Observable<OrderItem> {
    const url = `${this.apiUrl}/order_items`;
    const headers = this.getAuthHeaders();
    
    return this.http.post<OrderItem>(url, orderItemData, { headers });
  }

  /**
   * Create multiple order items
   */
  createOrderItems(orderId: number, items: OrderItemRequest[]): Observable<OrderItem[]> {
    const createRequests = items.map(item => {
      const orderItemData = {
        order_id: orderId,
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      };
      return this.createOrderItem(orderItemData);
    });

    return forkJoin(createRequests);
  }

  /**
   * Get all order items
   */
  getAllOrderItems(): Observable<OrderItem[]> {
    const url = `${this.apiUrl}/order_items`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<OrderItem[]>(url, { headers });
  }

  /**
   * Get order items by order ID
   */
  getOrderItemsByOrderId(orderId: number): Observable<OrderItem[]> {
    return this.getAllOrderItems().pipe(
      map(items => items.filter(item => item.order_id === orderId))
    );
  }

  /**
   * Update order item
   */
  updateOrderItem(itemId: number, updates: Partial<OrderItem>): Observable<OrderItem> {
    const url = `${this.apiUrl}/order_items/${itemId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.patch<OrderItem>(url, updates, { headers });
  }

  /**
   * Delete order item
   */
  deleteOrderItem(itemId: number): Observable<any> {
    const url = `${this.apiUrl}/order_items/${itemId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.delete(url, { headers });
  }

  // ===== PAYMENT OPERATIONS =====

  /**
   * Process payment
   */
  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.processPayment}`;
    const headers = this.getAuthHeaders();
    
    return this.http.post<PaymentModel>(url, paymentData, { headers });
  }

  /**
   * Get payment by ID
   */
  getPaymentById(paymentId: number): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.getPaymentStatus}/${paymentId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<PaymentModel>(url, { headers });
  }

  /**
   * Get payment by order ID
   */
  getPaymentByOrderId(orderId: number): Observable<PaymentModel[]> {
    const url = `${this.apiUrl}/payment`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<PaymentModel[]>(url, { headers }).pipe(
      map(payments => payments.filter(payment => payment.order_id === orderId))
    );
  }

  /**
   * Process refund
   */
  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.payment.refundPayment}/${paymentId}/refund`;
    const headers = this.getAuthHeaders();
    const payload = { amount, reason };
    
    return this.http.post<PaymentModel>(url, payload, { headers });
  }

  // ===== SHIPPING OPERATIONS =====

  /**
   * Get all shipping methods
   */
  getShippingMethods(): Observable<ShippingMethod[]> {
    const url = `${this.apiUrl}/shipping_methods`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<ShippingMethod[]>(url, { headers });
  }

  /**
   * Get active shipping methods
   */
  getActiveShippingMethods(): Observable<ShippingMethod[]> {
    return this.getShippingMethods().pipe(
      map(methods => methods.filter(method => method.is_active))
    );
  }

  /**
   * Get shipping method by ID
   */
  getShippingMethodById(methodId: number): Observable<ShippingMethod> {
    const url = `${this.apiUrl}/shipping_methods/${methodId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<ShippingMethod>(url, { headers });
  }

  /**
   * Get all shipping addresses
   */
  getShippingAddresses(): Observable<ShippingAddress[]> {
    const url = `${this.apiUrl}/shipping_addresses`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<ShippingAddress[]>(url, { headers });
  }

  /**
   * Get shipping addresses by user ID
   */
  getShippingAddressesByUserId(userId: number): Observable<ShippingAddress[]> {
    return this.getShippingAddresses().pipe(
      map(addresses => addresses.filter(addr => addr.user_id === userId && addr.is_active))
    );
  }

  /**
   * Get shipping address by ID
   */
  getShippingAddressById(addressId: number): Observable<ShippingAddress> {
    const url = `${this.apiUrl}/shipping_addresses/${addressId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<ShippingAddress>(url, { headers });
  }

  /**
   * Create shipping address
   */
  createShippingAddress(addressData: Omit<ShippingAddress, 'id' | 'created_at'>): Observable<ShippingAddress> {
    const url = `${this.apiUrl}/shipping_addresses`;
    const headers = this.getAuthHeaders();
    
    return this.http.post<ShippingAddress>(url, addressData, { headers });
  }

  /**
   * Update shipping address
   */
  updateShippingAddress(addressId: number, updates: Partial<ShippingAddress>): Observable<ShippingAddress> {
    const url = `${this.apiUrl}/shipping_addresses/${addressId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.patch<ShippingAddress>(url, updates, { headers });
  }

  /**
   * Delete shipping address
   */
  deleteShippingAddress(addressId: number): Observable<any> {
    const url = `${this.apiUrl}/shipping_addresses/${addressId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.delete(url, { headers });
  }

  /**
   * Get shipping status by order ID
   */
  getShippingStatusByOrderId(orderId: number): Observable<ShippingStatus[]> {
    const url = `${this.apiUrl}/shipping_status`;
    const headers = this.getAuthHeaders();
    
    return this.http.get<ShippingStatus[]>(url, { headers }).pipe(
      map(statuses => statuses.filter(status => status.order_id === orderId))
    );
  }

  /**
   * Update shipping status
   */
  updateShippingStatus(statusId: number, updates: Partial<ShippingStatus>): Observable<ShippingStatus> {
    const url = `${this.apiUrl}/shipping_status/${statusId}`;
    const headers = this.getAuthHeaders();
    
    return this.http.patch<ShippingStatus>(url, updates, { headers });
  }

  /**
   * Create shipping status
   */
  createShippingStatus(statusData: Omit<ShippingStatus, 'id' | 'created_at'>): Observable<ShippingStatus> {
    const url = `${this.apiUrl}/shipping_status`;
    const headers = this.getAuthHeaders();
    
    return this.http.post<ShippingStatus>(url, statusData, { headers });
  }

  // ===== UTILITY METHODS =====

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): { [key: string]: string } {
    return {
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get order with all related data
   */
  getOrderWithRelations(orderId: number): Observable<OrderModel> {
    return forkJoin({
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
  }

  /**
   * Get orders with all related data for user
   */
  getUserOrdersWithRelations(userId: number): Observable<OrderModel[]> {
    return forkJoin({
      orders: this.getOrdersByUserId(userId),
      allOrderItems: this.getAllOrderItems(),
      allShippingStatuses: this.http.get<ShippingStatus[]>(`${this.apiUrl}/shipping_status`, { headers: this.getAuthHeaders() }),
      allPayments: this.http.get<PaymentModel[]>(`${this.apiUrl}/payment`, { headers: this.getAuthHeaders() })
    }).pipe(
      map(({ orders, allOrderItems, allShippingStatuses, allPayments }) => {
        return orders.map(order => ({
          ...order,
          order_items: allOrderItems.filter(item => item.order_id === order.id),
          shipping_status: allShippingStatuses.find(status => status.order_id === order.id),
          payment: allPayments.find(payment => payment.order_id === order.id)
        }));
      })
    );
  }
}