// services/core/order-validation.service.ts
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { OrderModel, CreateOrderRequest, OrderStatus } from '../models/order.model';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class OrderValidationService {

  constructor(private authService: AuthService) {}

  // ===== CREATE ORDER VALIDATION =====

  /**
   * Comprehensive validation for order creation
   */
  validateCreateOrderRequest(orderData: CreateOrderRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic required fields
    if (!orderData.shipping_address_id) {
      errors.push('Shipping address is required');
    }

    if (!orderData.shipping_method_id) {
      errors.push('Shipping method is required');
    }

    // Items validation
    const itemValidation = this.validateOrderItems(orderData.items || []);
    if (!itemValidation.isValid) {
      errors.push(...itemValidation.errors);
    }

    // Business logic validation
    const businessValidation = this.validateBusinessRules(orderData);
    if (!businessValidation.isValid) {
      errors.push(...businessValidation.errors);
    }
    if (businessValidation.warnings) {
      warnings.push(...businessValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Validate order items
   */
  validateOrderItems(items: any[]): ValidationResult {
    const errors: string[] = [];

    if (!items || items.length === 0) {
      errors.push('Order must contain at least one item');
      return { isValid: false, errors };
    }

    items.forEach((item, index) => {
      const itemPrefix = `Item ${index + 1}:`;

      if (!item.product_id) {
        errors.push(`${itemPrefix} Product ID is required`);
      }

      if (!item.product_variant_id) {
        errors.push(`${itemPrefix} Product variant is required`);
      }

      if (!item.quantity || item.quantity <= 0) {
        errors.push(`${itemPrefix} Quantity must be greater than 0`);
      }

      if (!item.unit_price || item.unit_price <= 0) {
        errors.push(`${itemPrefix} Unit price must be greater than 0`);
      }

      // Check for reasonable quantity limits
      if (item.quantity > 999) {
        errors.push(`${itemPrefix} Quantity cannot exceed 999`);
      }

      // Check for reasonable price limits
      if (item.unit_price > 999999) {
        errors.push(`${itemPrefix} Unit price seems unusually high`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate business rules for order creation
   */
  validateBusinessRules(orderData: CreateOrderRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Calculate total
    const subtotal = this.calculateSubtotal(orderData.items || []);

    // Minimum order validation
    if (subtotal < 1) {
      errors.push('Order total must be at least $1.00');
    }

    // Maximum order validation
    if (subtotal > 50000) {
      warnings.push('Large order detected. Please contact customer service for orders over $50,000');
    }

    // Validate reasonable item quantities
    const totalItems = (orderData.items || []).reduce((total, item) => total + (item.quantity || 0), 0);
    
    if (totalItems > 100) {
      warnings.push('Large quantity order detected. Processing may take additional time');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ===== ORDER STATUS VALIDATION =====

  /**
   * Validate order status transitions
   */
  validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): ValidationResult {
    const errors: string[] = [];

    const validTransitions: { [key in OrderStatus]: OrderStatus[] } = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'returned'],
      'delivered': ['returned'],
      'cancelled': [], // Terminal state
      'refunded': [], // Terminal state
      'returned': ['refunded'] // Can be refunded after return
    };

    const allowedNextStatuses = validTransitions[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
      errors.push(`Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedNextStatuses.join(', ') || 'none'}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if order can be cancelled
   */
  canCancelOrder(order: OrderModel): ValidationResult {
    const errors: string[] = [];

    if (!['pending', 'confirmed'].includes(order.status)) {
      errors.push(`Order cannot be cancelled. Current status: ${order.status}`);
    }

    // Check if payment has been processed
    if (order.payment && order.payment.status === 'completed') {
      errors.push('Order cannot be cancelled after payment has been completed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if order can be returned
   */
  canReturnOrder(order: OrderModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (order.status !== 'delivered') {
      errors.push('Only delivered orders can be returned');
      return { isValid: false, errors };
    }

    // Check return window (30 days)
    const deliveredDate = new Date(order.shipping_status?.actual_delivery_date || order.order_date);
    const returnWindow = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = new Date();
    const timeElapsed = now.getTime() - deliveredDate.getTime();

    if (timeElapsed > returnWindow) {
      errors.push('Return period has expired. Returns must be initiated within 30 days of delivery');
    } else if (timeElapsed > (25 * 24 * 60 * 60 * 1000)) { // 25 days
      warnings.push('Return window expires soon. Please initiate return promptly');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // ===== ORDER OWNERSHIP VALIDATION =====

  /**
   * Validate that user owns the order
   */
  validateOrderOwnership(order: OrderModel): void {
    const currentUserId = this.authService.getUserId();
    
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    if (order.user_id !== currentUserId) {
      throw new Error('Access denied: Order does not belong to current user');
    }
  }

  // ===== SHIPPING VALIDATION =====

  /**
   * Validate shipping address completeness
   */
  validateShippingAddress(address: any): ValidationResult {
    const errors: string[] = [];

    if (!address) {
      errors.push('Shipping address is required');
      return { isValid: false, errors };
    }

    const requiredFields = [
      { field: 'first_name', message: 'First name is required' },
      { field: 'last_name', message: 'Last name is required' },
      { field: 'address_line_1', message: 'Street address is required' },
      { field: 'city', message: 'City is required' },
      { field: 'state', message: 'State is required' },
      { field: 'zip_code', message: 'ZIP code is required' },
      { field: 'country', message: 'Country is required' }
    ];

    requiredFields.forEach(({ field, message }) => {
      if (!address[field] || !address[field].toString().trim()) {
        errors.push(message);
      }
    });

    // Validate ZIP code format (basic US validation)
    if (address.zip_code && address.country === 'US') {
      const zipPattern = /^\d{5}(-\d{4})?$/;
      if (!zipPattern.test(address.zip_code)) {
        errors.push('Invalid ZIP code format');
      }
    }

    // Validate phone number if provided
    if (address.phone) {
      const phonePattern = /^[\+]?[\d\s\-\(\)]{10,}$/;
      if (!phonePattern.test(address.phone)) {
        errors.push('Invalid phone number format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate shipping method selection
   */
  validateShippingMethod(methodId: number, orderTotal: number, availableMethods: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const method = availableMethods.find(m => m.id === methodId);

    if (!method) {
      errors.push('Selected shipping method is not available');
      return { isValid: false, errors };
    }

    if (!method.is_active) {
      errors.push('Selected shipping method is currently unavailable');
    }

    // Check free shipping threshold
    if (method.free_shipping_threshold && orderTotal >= method.free_shipping_threshold) {
      warnings.push(`Free shipping available! Your order qualifies for free ${method.name}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // ===== PAYMENT VALIDATION =====

  /**
   * Validate payment data
   */
  validatePaymentData(paymentData: any): ValidationResult {
    const errors: string[] = [];

    if (!paymentData.order_id) {
      errors.push('Order ID is required for payment');
    }

    if (!paymentData.payment_method) {
      errors.push('Payment method is required');
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (paymentData.amount > 999999) {
      errors.push('Payment amount exceeds maximum limit');
    }

    // Validate payment method specific fields
    if (paymentData.payment_method === 'credit_card') {
      if (!paymentData.card_number) {
        errors.push('Credit card number is required');
      }
      if (!paymentData.expiry_date) {
        errors.push('Card expiry date is required');
      }
      if (!paymentData.cvv) {
        errors.push('CVV is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ===== PROMOTION VALIDATION =====

  /**
   * Validate promotion code application
   */
  validatePromotionCode(code: string, orderTotal: number, promotion: any): ValidationResult {
    const errors: string[] = [];

    if (!promotion) {
      errors.push('Invalid promotion code');
      return { isValid: false, errors };
    }

    if (!promotion.is_active) {
      errors.push('This promotion is no longer active');
    }

    // Check date validity
    const currentDate = new Date().toISOString().split('T')[0];
    if (currentDate < promotion.start_date) {
      errors.push('This promotion is not yet active');
    }

    if (currentDate > promotion.end_date) {
      errors.push('This promotion has expired');
    }

    // Check minimum order amount
    if (promotion.minimum_order_amount && orderTotal < promotion.minimum_order_amount) {
      errors.push(`Minimum order amount of ${promotion.minimum_order_amount} required for this promotion`);
    }

    // Check usage limits
    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      errors.push('This promotion has reached its usage limit');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ===== DATA INTEGRITY VALIDATION =====

  /**
   * Validate order data integrity
   */
  validateOrderIntegrity(order: OrderModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if calculated total matches stored total
    if (order.order_items && order.order_items.length > 0) {
      const calculatedSubtotal = this.calculateSubtotal(order.order_items);
      const expectedTotal = calculatedSubtotal + (order.shipping_cost || 0);
      
      if (Math.abs(expectedTotal - order.total_amount) > 0.01) {
        warnings.push('Order total calculation mismatch detected');
      }
    }

    // Validate item prices
    order.order_items?.forEach((item, index) => {
      const calculatedTotal = item.unit_price * item.quantity;
      if (Math.abs(calculatedTotal - item.total_price) > 0.01) {
        warnings.push(`Item ${index + 1}: Price calculation mismatch`);
      }
    });

    // Check for missing required relationships
    if (!order.shipping_addresses_id) {
      errors.push('Missing shipping address reference');
    }

    if (!order.shipping_methods_id) {
      errors.push('Missing shipping method reference');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // ===== INVENTORY VALIDATION =====

  /**
   * Validate item availability (mock implementation)
   */
  validateInventoryAvailability(items: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    items.forEach((item, index) => {
      // Mock inventory check - in real implementation, this would check actual inventory
      const mockStockLevel = Math.floor(Math.random() * 100) + 1;
      
      if (item.quantity > mockStockLevel) {
        errors.push(`Item ${index + 1}: Insufficient stock. Only ${mockStockLevel} available`);
      } else if (item.quantity > mockStockLevel * 0.8) {
        warnings.push(`Item ${index + 1}: Low stock warning`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Calculate subtotal from items
   */
  private calculateSubtotal(items: any[]): number {
    return items.reduce((total, item) => {
      const unitPrice = item.unit_price || 0;
      const quantity = item.quantity || 0;
      return total + (unitPrice * quantity);
    }, 0);
  }

  /**
   * Get comprehensive validation summary
   */
  getValidationSummary(order: OrderModel): {
    overall: ValidationResult;
    details: {
      canCancel: ValidationResult;
      canReturn: ValidationResult;
      integrity: ValidationResult;
    };
  } {
    const canCancel = this.canCancelOrder(order);
    const canReturn = this.canReturnOrder(order);
    const integrity = this.validateOrderIntegrity(order);

    const allErrors = [
      ...canCancel.errors,
      ...canReturn.errors,
      ...integrity.errors
    ];

    const allWarnings = [
      ...(canCancel.warnings || []),
      ...(canReturn.warnings || []),
      ...(integrity.warnings || [])
    ];

    return {
      overall: {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      },
      details: {
        canCancel,
        canReturn,
        integrity
      }
    };
  }

  /**
   * Quick validation check for common operations
   */
  quickValidate(order: OrderModel, operation: 'view' | 'cancel' | 'return' | 'modify'): boolean {
    try {
      this.validateOrderOwnership(order);

      switch (operation) {
        case 'cancel':
          return this.canCancelOrder(order).isValid;
        case 'return':
          return this.canReturnOrder(order).isValid;
        case 'modify':
          return ['pending', 'confirmed'].includes(order.status);
        case 'view':
        default:
          return true;
      }
    } catch {
      return false;
    }
  }
}