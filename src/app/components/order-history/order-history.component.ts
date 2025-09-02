import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, switchMap } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faBox, faChevronLeft, faChevronRight, faCreditCard, faDownload, faDollarSign, faExclamationTriangle, faExternalLink, faEye, faFilter, faRedo, faRefresh, faShoppingBag, faShoppingCart, faTimes, faTruck, faUndo } from '@fortawesome/free-solid-svg-icons';
import { OrderService } from '../../services/order.service';
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
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load orders using the new order_items based approach
   */
  loadOrders(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Build filters
    const filters: OrderFilterOptions = {};
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.dateFromFilter) filters.date_from = this.dateFromFilter;
    if (this.dateToFilter) filters.date_to = this.dateToFilter;
    
    // Use the new method that fetches from order_items table
    this.orderService.getUserOrdersWithItems(this.currentPage, this.perPage, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: OrderResponse) => {
          console.log('=== ORDERS WITH ITEMS DEBUG ===');
          console.log('Response:', response);
          console.log('Number of orders:', response.items?.length || 0);
          
          if (response.items && response.items.length > 0) {
            response.items.forEach((order, index) => {
              console.log(`Order ${index + 1} (ID: ${order.id}):`);
              console.log('  - Order items:', order.order_items?.length || 0);
              if (order.order_items && order.order_items.length > 0) {
                console.log('  - First item:', order.order_items[0]);
                console.log('  - Product name:', order.order_items[0].product?.name || 'No product name');
              }
            });
          }
          console.log('=== END DEBUG ===');

          this.orders = response.items || [];
          this.totalOrders = response.itemsTotal || 0;
          this.totalPages = response.pageTotal || 0;
          this.currentPage = response.curPage || 1;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading orders:', error);
          this.errorMessage = 'Failed to load orders. Please try again.';
          this.loading = false;
        }
      });
  }

  /**
   * Load order details using the new order_items based approach
   */
  loadOrderDetails(orderId: number): void {
    this.detailsLoading = true;
    this.currentView = 'details';
    this.errorMessage = '';
    
    // Use the new method that combines order and order_items
    this.orderService.getOrderWithItems(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order: OrderModel) => {
          console.log('=== ORDER DETAILS WITH ITEMS DEBUG ===');
          console.log('Order:', order);
          console.log('Order items count:', order.order_items?.length || 0);
          if (order.order_items && order.order_items.length > 0) {
            console.log('Order items:', order.order_items);
            order.order_items.forEach((item, index) => {
              console.log(`Item ${index + 1}:`, {
                id: item.id,
                product_id: item.product_id,
                product_variant_id: item.product_variant_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
                product_name: item.product?.name || 'No product name',
                product_image: item.product?.main_image_url || 'No image'
              });
            });
          }
          console.log('=== END DEBUG ===');
          
          this.selectedOrder = order;
          this.detailsLoading = false;
        },
        error: (error) => {
          console.error('Error loading order details:', error);
          this.errorMessage = 'Failed to load order details.';
          this.detailsLoading = false;
          this.currentView = 'list';
        }
      });
  }

  backToList(): void {
    this.currentView = 'list';
    this.selectedOrder = null;
    this.errorMessage = '';
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadOrders();
    }
  }

  // Filter methods
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

  getStatusBadgeClass(status: OrderStatus): string {
    const baseClass = 'badge';
    const colorClass = 'bg-' + this.orderService.getOrderStatusColor(status);
    const textClass = status === 'pending' ? 'text-dark' : 'text-white';
    return `${baseClass} ${colorClass} ${textClass}`;
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  formatDateTime(dateString: string): string {
    return this.orderService.formatOrderDate(dateString);
  }

  formatCurrency(amount: number | undefined): string {
    return this.orderService.formatCurrency(amount || 0);
  }

  getTotalItems(order: OrderModel): number {
    // Calculate from actual order_items data
    return order.order_items?.reduce((total, item) => total + item.quantity, 0) || 0;
  }

  getOrderSubtotal(order: OrderModel): number {
    // Calculate from actual order_items data
    return order.order_items?.reduce((total, item) => total + item.total_price, 0) || 0;
  }

  canCancelOrder(order: OrderModel): boolean {
    return this.orderService.canCancelOrder(order);
  }

  canReturnOrder(order: OrderModel): boolean {
    return this.orderService.canReturnOrder(order);
  }

  canReorderOrder(order: OrderModel): boolean {
    return this.orderService.canReorderOrder(order);
  }

  hasTrackingInfo(order: OrderModel): boolean {
    return this.orderService.hasTrackingInfo(order);
  }

  cancelOrder(orderId: number): void {
    const confirmCancel = confirm('Are you sure you want to cancel this order?');
    if (!confirmCancel) return;

    const reason = prompt('Please enter the reason for cancellation (optional):');
    if (reason !== null) { // User didn't click cancel on prompt
      this.orderService.cancelOrder(orderId, reason || undefined)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedOrder) => {
            // Update the order in the list
            const index = this.orders.findIndex(o => o.id === orderId);
            if (index !== -1) {
              this.orders[index] = { ...this.orders[index], ...updatedOrder };
            }
            
            // Update selected order if it's the one being cancelled
            if (this.selectedOrder?.id === orderId) {
              this.selectedOrder = { ...this.selectedOrder, ...updatedOrder };
            }
          },
          error: (error) => {
            console.error('Error cancelling order:', error);
          }
        });
    }
  }

  trackOrder(order: OrderModel): void {
    const trackingUrl = this.orderService.getTrackingUrl(order);
    if (trackingUrl) {
      window.open(trackingUrl, '_blank');
    } else {
      alert('Tracking information not available for this order.');
    }
  }

  reorder(order: OrderModel): void {
    // Use the order_items data directly since we now have it loaded
    if (order.order_items && order.order_items.length > 0) {
      const reorderItems = order.order_items.map(item => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity,
        product_name: item.product?.name || 'Unknown Product',
        current_price: item.unit_price,
        image_url: item.product?.main_image_url || '',
        brand: item.product?.brand || '',
        in_stock: true
      }));

      console.log('Reorder items from order_items:', reorderItems);
      
      // Navigate to cart with reorder items
      this.router.navigate(['/cart'], { 
        queryParams: { reorder: order.id },
        state: { reorderItems: reorderItems }
      });
    } else {
      // Fallback to API call if no items loaded
      this.orderService.getReorderItems(order.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (items) => {
            console.log('Reorder items from API:', items);
            this.router.navigate(['/cart'], { 
              queryParams: { reorder: order.id },
              state: { reorderItems: items }
            });
          },
          error: (error) => {
            console.error('Error getting reorder items:', error);
          }
        });
    }
  }

  downloadInvoice(orderId: number): void {
    this.orderService.generateInvoice(orderId)
      .pipe(
        switchMap(invoice => this.orderService.downloadInvoice(invoice.id)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `invoice-${orderId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Error downloading invoice:', error);
        }
      });
  }

  getEstimatedDelivery(order: OrderModel): string {
    const estimatedDate = this.orderService.getEstimatedDeliveryDate(order);
    if (estimatedDate) {
      return this.formatDate(estimatedDate.toISOString());
    }
    return 'Not available';
  }

  trackByOrderId(index: number, order: OrderModel): number {
    return order.id;
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  refreshOrders(): void {
    this.loadOrders();
  }

  // Utility methods for template
  getProductNames(order: OrderModel): string {
    if (order.order_items && order.order_items.length > 0) {
      const names = order.order_items
        .map(item => item.product?.name || 'Unknown Product')
        .slice(0, 3);
      
      const result = names.join(', ');
      
      if (order.order_items.length > 3) {
        return result + ` and ${order.order_items.length - 3} more`;
      }
      
      return result;
    }
    return 'No items';
  }

  getShippingMethodName(order: OrderModel): string {
    return this.orderService.getShippingMethodName(order);
  }

  getPaymentMethodName(order: OrderModel): string {
    return this.orderService.getPaymentMethodName(order);
  }

  getPaymentStatus(order: OrderModel): string {
    return this.orderService.getOrderPaymentStatus(order);
  }

  getShippingStatus(order: OrderModel): string {
    return this.orderService.getShippingStatus(order);
  }

  getTrackingNumber(order: OrderModel): string {
    return order.shipping_status?.tracking_number || 'Not available';
  }

  getCarrierUpdate(order: OrderModel): string {
    return order.shipping_status?.carrier_update || 'No updates';
  }

  // Helper method for showing/hiding pagination
  shouldShowPagination(): boolean {
    return this.totalPages > 1;
  }

  // Helper method to check if there are orders to display
  hasOrders(): boolean {
    return this.orders && this.orders.length > 0;
  }

  // Helper method to get status display text
  getStatusText(status: OrderStatus): string {
    return this.orderService.getOrderStatusText(status);
  }

  /**
   * Track by function for order items
   */
  trackByItemId(index: number, item: any): number {
    return item.id;
  }
}