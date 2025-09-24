// order-history.component.ts - UPDATED VERSION
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faBox, faChevronLeft, faChevronRight, faCreditCard, faDownload, faDollarSign, faExclamationTriangle, faExternalLink, faEye, faFilter, faRedo, faRefresh, faShoppingBag, faShoppingCart, faTimes, faTruck, faUndo } from '@fortawesome/free-solid-svg-icons';
import { OrderService } from '../../services/order.service';
import { OrderBusinessLogicService } from '../../services/order-business-logic.service';
import { OrderUtilityService } from '../../services/order-utility.service';
import { AuthService } from '../../services/auth.service';
import { OrderModel, OrderResponse, OrderStatus, OrderFilterOptions } from '../../models/order.model';
import { CharInitialsPipe } from "../../shared/char-initials.pipe";

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, CharInitialsPipe, RouterModule, FormsModule, FontAwesomeModule],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.scss'
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  orders: OrderModel[] = [];
  selectedOrder: OrderModel | null = null;
  loading = false;
  detailsLoading = false;
  currentView: 'list' | 'details' = 'list';
  currentPage = 1;
  perPage = 10;
  totalOrders = 0;
  totalPages = 0;
  errorMessage = '';

  // FontAwesome icons
  faArrowLeft = faArrowLeft;
  faBox = faBox;
  faChevronLeft = faChevronLeft;
  faChevronRight = faChevronRight;
  faCreditCard = faCreditCard;
  faDownload = faDownload;
  faDollarSign = faDollarSign;
  faExclamationTriangle = faExclamationTriangle;
  faExternalLink = faExternalLink;
  faEye = faEye;
  faFilter = faFilter;
  faRedo = faRedo;
  faRefresh = faRefresh;
  faShoppingBag = faShoppingBag;
  faShoppingCart = faShoppingCart;
  faTimes = faTimes;
  faTruck = faTruck;
  faUndo = faUndo;

  // Filter options
  statusFilter: OrderStatus | '' = '';
  dateFromFilter = '';
  dateToFilter = '';

  // Available order statuses for filter dropdown
  orderStatuses: OrderStatus[] = [
    'pending',
    'confirmed', 
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
    'returned'
  ];

  private destroy$ = new Subject<void>();

  constructor(
    public orderService: OrderService,
    public orderBusinessLogicService: OrderBusinessLogicService,
    public orderUtilityService: OrderUtilityService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      console.log('User not logged in, redirecting...');
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: '/order-history' }
      });
      return;
    }
    
    console.log('Order History component initialized for user:', this.authService.getUserId());
    
    try {
      this.loadOrders();
    } catch (error) {
      console.error('Error during component initialization:', error);
      this.errorMessage = 'Failed to initialize order history';
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear any remaining loading states
    this.loading = false;
    this.detailsLoading = false;
  }

  /**
   * UPDATED: Load orders using new order service
   */
  loadOrders(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Build filters for API call
    const filters: OrderFilterOptions = {};
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.dateFromFilter) filters.date_from = this.dateFromFilter;
    if (this.dateToFilter) filters.date_to = this.dateToFilter;
    
    // Use the new getUserOrders method
    this.orderService.getOrders(this.currentPage, this.perPage, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: OrderResponse) => {
          console.log('Orders loaded successfully:', response);
          
          this.orders = response.items || [];
          this.totalOrders = response.itemsTotal || 0;
          this.totalPages = response.pageTotal || 0;
          this.currentPage = response.curPage || 1;
          this.loading = false;
          this.errorMessage = '';
          
          // Debug log for troubleshooting
          if (this.orders.length > 0) {
            console.log('First order sample:', this.orders[0]);
            console.log('Orders with action availability:', this.orders.map(order => ({
              id: order.id,
              status: order.status,
              canCancel: this.orderService.canCancelOrder(order),
              canReorder: this.canReorderOrder(order),
              hasTracking: this.hasTrackingInfo(order)
            })));
          }
        },
        error: (error) => {
          console.error('Error loading orders:', error);
          this.loading = false;
          
          let errorMessage = 'Failed to load orders';
          if (error.status === 401) {
            errorMessage = 'Please log in to view your orders';
            this.router.navigate(['/login']);
          } else if (error.status === 403) {
            errorMessage = 'You do not have permission to view orders';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.errorMessage = errorMessage;
        }
      });
  }

  /**
   * UPDATED: Load order details using new order service
   */
  loadOrderDetails(orderId: number): void {
    this.detailsLoading = true;
    this.currentView = 'details';
    this.errorMessage = '';
    
    this.orderService.getOrder(orderId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.detailsLoading = false;
        })
      )
      .subscribe({
        next: (order: OrderModel) => {
          console.log('Order details loaded successfully:', order);
          this.selectedOrder = order;
          this.errorMessage = '';
        },
        error: (error) => {
          console.error('Error loading order details:', error);
          
          let errorMessage = 'Failed to load order details';
          if (error.message?.includes('Access denied')) {
            errorMessage = 'You can only view your own orders';
          } else if (error.status === 404) {
            errorMessage = 'Order not found';
          } else if (error.status === 401) {
            errorMessage = 'Please log in to view order details';
            this.router.navigate(['/login']);
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
          
          this.errorMessage = errorMessage;
          this.currentView = 'list';
        }
      });
  }

  /**
   * UPDATED: Cancel order using new order service
   */
  cancelOrder(orderId: number): void {
    // Prevent multiple cancellation attempts
    if (this.loading || this.detailsLoading) {
      return;
    }

    // Find the order to check its status
    const orderToCancel = this.orders.find(o => o.id === orderId) || this.selectedOrder;
    
    if (!orderToCancel) {
      this.errorMessage = 'Order not found';
      return;
    }

    // Check if order can be cancelled before showing confirmation
    if (!this.orderService.canCancelOrder(orderToCancel)) {
      alert(`Cannot cancel order: Order status is ${this.getStatusText(orderToCancel.status)}`);
      return;
    }

    // Enhanced confirmation dialog with order details
    const orderTotal = orderToCancel.total_amount.toFixed(2);
    const orderDate = this.formatDate(orderToCancel.order_date);
    
    const confirmMessage = 
      `Cancel Order #${orderId}?\n\n` +
      `Order Date: ${orderDate}\n` +
      `Total: $${orderTotal}\n` +
      `Status: ${this.getStatusText(orderToCancel.status)}\n\n` +
      `This action cannot be undone. Are you sure?`;
      
    const confirmCancel = confirm(confirmMessage);
    if (!confirmCancel) return;

    // Optional cancellation reason
    const reason = prompt('Please enter the reason for cancellation (optional):');
    if (reason === null) return; // User clicked cancel on prompt

    // Set loading state
    this.loading = true;
    this.errorMessage = '';

    this.orderService.cancelOrder(orderId, reason || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedOrder) => {
          console.log('Order cancelled successfully:', updatedOrder);
          
          // Update the order in the orders list
          const orderIndex = this.orders.findIndex(o => o.id === orderId);
          if (orderIndex !== -1) {
            this.orders[orderIndex] = { 
              ...this.orders[orderIndex], 
              ...updatedOrder,
              status: 'cancelled'
            };
          }
          
          // Update selected order if viewing details
          if (this.selectedOrder?.id === orderId) {
            this.selectedOrder = { 
              ...this.selectedOrder, 
              ...updatedOrder,
              status: 'cancelled'
            };
          }
          
          this.loading = false;
          this.errorMessage = '';
        },
        error: (error) => {
          console.error('Error cancelling order:', error);
          this.loading = false;
          
          // Set component error message for display
          this.errorMessage = error.message || 'Failed to cancel order';
        }
      });
  }

  /**
   * UPDATED: Download invoice using new order service
   */
  downloadInvoice(orderId: number): void {
    // Add loading state to prevent multiple clicks
    if (this.loading || this.detailsLoading) {
      return;
    }

    // Verify order exists
    const order = this.orders.find(o => o.id === orderId) || this.selectedOrder;
    if (!order) {
      this.errorMessage = 'Order not found';
      return;
    }

    // Set loading state
    this.loading = true;
    this.errorMessage = '';

    // Use the new order service method
    this.orderBusinessLogicService.downloadInvoice(orderId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (blob) => {
          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `invoice-${orderId}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          console.log('Invoice downloaded successfully');
        },
        error: (error) => {
          console.error('Error downloading invoice:', error);
          this.errorMessage = 'Failed to download invoice';
        }
      });
  }

  /**
   * UPDATED: Track order using new utility methods
   */
  trackOrder(order: OrderModel): void {
    if (!order) {
      alert('Order information not available');
      return;
    }

    // Check if tracking information exists
    if (!this.hasTrackingInfo(order)) {
      const statusText = this.getStatusText(order.status);
      alert(
        `Tracking information is not available yet.\n\n` +
        `Order Status: ${statusText}\n` +
        `Order #${order.id}\n\n` +
        `Tracking information will be available once your order ships.`
      );
      return;
    }

    const trackingUrl = this.orderService.getTrackingUrl(order);
    const trackingNumber = this.getTrackingNumber(order);
    const carrier = order.shipping_method?.carrier || 'the carrier';
    
    if (trackingUrl) {
      try {
        // Attempt to open tracking URL
        const newWindow = window.open(trackingUrl, '_blank', 'noopener,noreferrer');
        
        // Check if popup was blocked
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Fallback: show tracking information in alert
          alert(
            `Popup blocked. Here's your tracking information:\n\n` +
            `Tracking Number: ${trackingNumber}\n` +
            `Carrier: ${carrier}\n` +
            `Track at: ${trackingUrl}\n\n` +
            `Please copy the tracking number and visit ${carrier} website manually.`
          );
        }
      } catch (error) {
        console.error('Error opening tracking URL:', error);
        
        // Show tracking information as fallback
        alert(
          `Error opening tracking page.\n\n` +
          `Tracking Number: ${trackingNumber}\n` +
          `Carrier: ${carrier}\n\n` +
          `Please visit ${carrier} website and enter this tracking number manually.`
        );
      }
    } else {
      // No tracking URL available, show tracking number only
      alert(
        `Tracking Number: ${trackingNumber}\n` +
        `Carrier: ${carrier}\n\n` +
        `Please visit ${carrier} website to track your package.`
      );
    }
  }

  /**
   * UPDATED: Reorder functionality using new order service
   */
  reorder(order: OrderModel): void {
    if (!order) {
      this.errorMessage = 'Order information not available';
      return;
    }

    // Check if order can be reordered
    if (!this.canReorderOrder(order)) {
      alert(`This order cannot be reordered. Status: ${this.getStatusText(order.status)}`);
      return;
    }

    // Set loading state
    this.loading = true;
    this.errorMessage = '';
    
    this.orderService.getReorderItems(order.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (items) => {
          if (!items || items.length === 0) {
            this.errorMessage = 'No items available for reordering';
            return;
          }
          
          console.log('Reorder items loaded:', items);
          
          // Navigate to cart with reorder data
          this.router.navigate(['/cart'], { 
            queryParams: { reorder: order.id },
            state: { reorderItems: items }
          });
        },
        error: (error) => {
          console.error('Error loading reorder items:', error);
          this.errorMessage = 'Failed to load items for reordering. Please try again.';
        }
      });
  }

  /**
   * Back to list with proper cleanup
   */
  backToList(): void {
    this.currentView = 'list';
    this.selectedOrder = null;
    this.errorMessage = '';
    this.detailsLoading = false;
  }

  /**
   * Refresh orders with loading state management
   */
  refreshOrders(): void {
    this.errorMessage = '';
    this.currentPage = 1; // Reset to first page
    this.loadOrders();
  }

  /**
   * Page change handler
   */
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadOrders();
    }
  }

  /**
   * Filter change handlers
   */
  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.loadOrders();
  }

  onDateFilterChange(): void {
    this.currentPage = 1;
    this.loadOrders();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.dateFromFilter = '';
    this.dateToFilter = '';
    this.currentPage = 1;
    this.loadOrders();
  }

  // ===== UTILITY METHODS USING NEW ORDER SERVICE =====

  /**
   * Get status badge class for UI styling
   */
  getStatusBadgeClass(status: OrderStatus): string {
    const baseClass = 'badge';
    const colorClass = 'bg-' + this.orderService.getOrderStatusColor(status);
    const textClass = status === 'pending' ? 'text-dark' : 'text-white';
    return `${baseClass} ${colorClass} ${textClass}`;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return this.orderService.formatOrderDate(dateString);
  }

  /**
   * Format date and time for display
   */
  formatDateTime(dateString: string): string {
    return this.orderService.formatOrderDate(dateString);
  }

  /**
   * Format currency amount
   */
  formatCurrency(amount: number | undefined): string {
    return this.orderService.formatCurrency(amount || 0);
  }

  /**
   * Get total items in order
   */
  getTotalItems(order: OrderModel): number {
    return this.orderService.getTotalItemsInOrder(order);
  }

  /**
   * Get order subtotal
   */
  getOrderSubtotal(order: OrderModel): number {
    return this.orderService.getOrderSubtotal(order);
  }

  /**
   * Check if order can be cancelled
   */
  canCancelOrder(order: OrderModel): boolean {
    return this.orderService.canCancelOrder(order);
  }

  /**
   * Check if order can be returned
   */
  canReturnOrder(order: OrderModel): boolean {
    return this.orderService.canReturnOrder(order);
  }

  /**
   * Check if order can be reordered
   */
  canReorderOrder(order: OrderModel): boolean {
    return this.orderBusinessLogicService.canReorderOrder(order);
  }

  /**
   * Check if order has tracking info
   */
  hasTrackingInfo(order: OrderModel): boolean {
    return this.orderService.hasTrackingInfo(order);
  }

  /**
   * Get estimated delivery date
   */
  getEstimatedDelivery(order: OrderModel): string {
    const estimatedDate = this.orderService.getEstimatedDeliveryDate(order);
    if (estimatedDate) {
      return this.formatDate(estimatedDate.toISOString());
    }
    return 'Not available';
  }

  /**
   * Get shipping method name
   */
  getShippingMethodName(order: OrderModel): string {
    return this.orderUtilityService.getShippingMethodName(order);
  }

  /**
   * Get payment method name
   */
  getPaymentMethodName(order: OrderModel): string {
    return this.orderUtilityService.getPaymentMethodName(order);
  }

  /**
   * Get payment status
   */
  getPaymentStatus(order: OrderModel): string {
    if (!order.payment) return 'Pending';
    
    const status = order.payment.status;
    return status.replace(/_/g, ' ')
                 .replace(/\b\w/g, l => l.toUpperCase());
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
   * Get tracking number
   */
  getTrackingNumber(order: OrderModel): string {
    return order.shipping_status?.tracking_number || 'Not available';
  }

  /**
   * Get carrier update
   */
  getCarrierUpdate(order: OrderModel): string {
    return order.shipping_status?.carrier_update || 'No updates';
  }

  /**
   * Get status display text
   */
  getStatusText(status: OrderStatus): string {
    return this.orderService.getOrderStatusText(status);
  }

  /**
   * Get product names from order (for display)
   */
  getProductNames(order: OrderModel): string {
    return this.orderService.getProductNamesFromOrder(order);
  }

  // ===== PAGINATION AND UI HELPERS =====

  /**
   * Track by function for order list performance
   */
  trackByOrderId(index: number, order: OrderModel): number {
    return order.id;
  }

  /**
   * Track by function for order items
   */
  trackByItemId(index: number, item: any): number {
    return item.id;
  }

  /**
   * Get pages array for pagination
   */
  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /**
   * Check if pagination should be shown
   */
  shouldShowPagination(): boolean {
    return this.totalPages > 1;
  }

  /**
   * Check if there are orders to display
   */
  hasOrders(): boolean {
    return this.orders && this.orders.length > 0;
  }

  /**
   * Check if user can perform actions on order
   */
  canPerformOrderActions(order: OrderModel): boolean {
    const currentUserId = this.authService.getUserId();
    return order.user_id === currentUserId;
  }

  // ===== DEBUGGING METHODS =====

  /**
   * Debug order state for troubleshooting
   */
  debugOrderState(order: OrderModel): void {
    console.log('=== ORDER DEBUG INFO ===');
    console.log('Order ID:', order.id);
    console.log('Order Status:', order.status);
    console.log('Can Cancel:', this.orderService.canCancelOrder(order));
    console.log('Can Reorder:', this.canReorderOrder(order));
    console.log('Can Return:', this.canReturnOrder(order));
    console.log('Has Items:', order.order_items?.length || 0);
    console.log('Has Payment:', !!order.payment);
    console.log('Has Shipping:', !!order.shipping_status);
    console.log('Has Tracking:', this.hasTrackingInfo(order));
    console.log('User ID:', order.user_id);
    console.log('Current User ID:', this.authService.getUserId());
    console.log('User Match:', this.canPerformOrderActions(order));
    
    if (order.order_items && order.order_items.length > 0) {
      console.log('Order Items:', order.order_items.map(item => ({
        id: item.id,
        product_name: item.product?.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      })));
    }
    
    console.log('=== END DEBUG ===');
  }
}