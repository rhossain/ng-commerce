// services/payments/order-payment.service.ts
import { Injectable } from '@angular/core';
import { Observable, throwError, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { OrderRepositoryService } from './order-repository.service';
import { OrderValidationService } from './order-validation.service';
import { PaymentModel, PaymentRequest, PromotionModel } from '../models/order.model';

@Injectable({
  providedIn: 'root'
})
export class OrderPaymentService {
  
  // Cache for promotions to avoid repeated API calls
  private promotionsCache$ = new BehaviorSubject<PromotionModel[]>([]);
  private promotionsCacheTimestamp = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Mock promotions data (in real app, this would come from API)
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
    private validation: OrderValidationService,
    private toastr: ToastrService
  ) {
    this.initializePromotionsCache();
  }

  // ===== PAYMENT PROCESSING =====

  /**
   * Process payment with validation
   */
  processPayment(paymentData: PaymentRequest): Observable<PaymentModel> {
    // Validate payment data before processing
    const validationResult = this.validation.validatePaymentData(paymentData);
    if (!validationResult.isValid) {
      const errorMessage = validationResult.errors.join(', ');
      this.toastr.error(errorMessage, 'Payment Validation Failed');
      return throwError(() => new Error(errorMessage));
    }

    return this.orderRepository.processPayment(paymentData).pipe(
      tap(payment => {
        if (payment.status === 'completed') {
          this.toastr.success('Payment processed successfully', 'Payment Complete');
        } else if (payment.status === 'pending') {
          this.toastr.info('Payment is being processed', 'Payment Pending');
        } else if (payment.status === 'failed') {
          this.toastr.error('Payment processing failed', 'Payment Failed');
        }
      }),
      catchError(error => {
        this.toastr.error('Payment processing failed. Please try again.', 'Payment Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Get payment status with caching
   */
  getPaymentStatus(paymentId: number): Observable<PaymentModel> {
    return this.orderRepository.getPaymentById(paymentId).pipe(
      catchError(error => {
        console.error(`Error fetching payment ${paymentId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Process refund with validation
   */
  processRefund(paymentId: number, amount: number, reason?: string): Observable<PaymentModel> {
    if (amount <= 0) {
      const error = 'Refund amount must be greater than 0';
      this.toastr.error(error, 'Invalid Refund Amount');
      return throwError(() => new Error(error));
    }

    return this.orderRepository.processRefund(paymentId, amount, reason).pipe(
      tap(refund => {
        this.toastr.success(`Refund of $${amount.toFixed(2)} processed successfully`, 'Refund Complete');
      }),
      catchError(error => {
        this.toastr.error('Refund processing failed. Please contact support.', 'Refund Error');
        return throwError(() => error);
      })
    );
  }

  // ===== PROMOTION MANAGEMENT =====

  /**
   * Get available promotions with caching
   */
  getAvailablePromotions(): Observable<PromotionModel[]> {
    // Check cache first
    if (this.isPromotionsCacheValid()) {
      return this.promotionsCache$.asObservable();
    }

    // In a real app, this would be an API call
    const activePromotions = this.mockPromotions.filter(p => p.is_active);
    
    this.updatePromotionsCache(activePromotions);
    return of(activePromotions);
  }

  /**
   * Validate promotion code with comprehensive checks
   */
  validatePromotionCode(code: string, orderTotal: number): Observable<PromotionModel> {
    return this.getAvailablePromotions().pipe(
      map(promotions => {
        const promotion = promotions.find(p => 
          p.code.toLowerCase() === code.toLowerCase().trim()
        );

        if (!promotion) {
          throw { status: 404, message: 'Promotion code not found' };
        }

        // Use validation service for detailed checks
        const validationResult = this.validation.validatePromotionCode(code, orderTotal, promotion);
        
        if (!validationResult.isValid) {
          throw { status: 400, message: validationResult.errors.join(', ') };
        }

        return promotion;
      }),
      tap(promotion => {
        this.toastr.success(`Promotion "${promotion.code}" applied successfully!`, 'Promotion Applied');
      }),
      catchError(error => {
        const message = error.message || 'Invalid promotion code';
        this.toastr.error(message, 'Promotion Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * Calculate discount amount for a promotion
   */
  calculateDiscount(promotion: PromotionModel, orderTotal: number): number {
    let discount = 0;
    
    switch (promotion.discount_type) {
      case 'percentage':
        discount = (orderTotal * promotion.discount_value) / 100;
        if (promotion.maximum_discount_amount && discount > promotion.maximum_discount_amount) {
          discount = promotion.maximum_discount_amount;
        }
        break;
        
      case 'fixed_amount':
        discount = Math.min(promotion.discount_value, orderTotal);
        break;
        
      case 'free_shipping':
        // For free shipping, return 0 as the discount is applied to shipping cost
        discount = 0;
        break;
    }
    
    return Math.round(discount * 100) / 100;
  }

  /**
   * Apply promotion and update usage count
   */
  usePromotion(code: string): Observable<void> {
    const promotion = this.mockPromotions.find(p => 
      p.code.toLowerCase() === code.toLowerCase().trim()
    );
    
    if (promotion) {
      promotion.usage_count++;
      // In real app, this would make an API call to update the backend
    }

    return of(void 0);
  }

  /**
   * Check if promotion provides free shipping
   */
  providesFreeshipping(promotion: PromotionModel): boolean {
    return promotion.discount_type === 'free_shipping';
  }

  // ===== CALCULATION UTILITIES =====

  /**
   * Calculate order total with promotions and shipping
   */
  calculateOrderTotal(
    subtotal: number,
    shippingCost: number,
    taxRate: number = 0,
    promotion?: PromotionModel | null
  ): {
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    savings: number;
  } {
    let finalShippingCost = shippingCost;
    let discountAmount = 0;
    let savings = 0;

    if (promotion) {
      discountAmount = this.calculateDiscount(promotion, subtotal);
      
      if (promotion.discount_type === 'free_shipping') {
        savings += shippingCost;
        finalShippingCost = 0;
      } else {
        savings += discountAmount;
      }
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const tax = Math.round(taxableAmount * taxRate * 100) / 100;
    const total = Math.max(0, subtotal + finalShippingCost + tax - discountAmount);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: Math.round(finalShippingCost * 100) / 100,
      tax,
      discount: Math.round(discountAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
      savings: Math.round(savings * 100) / 100
    };
  }

  /**
   * Calculate subtotal from order items
   */
  calculateSubtotal(items: Array<{ unit_price: number; quantity: number }>): number {
    const subtotal = items.reduce((total, item) => {
      return total + (item.unit_price * item.quantity);
    }, 0);
    
    return Math.round(subtotal * 100) / 100;
  }

  /**
   * Calculate tax amount
   */
  calculateTax(amount: number, taxRate: number): number {
    return Math.round(amount * taxRate * 100) / 100;
  }

  // ===== PAYMENT METHOD UTILITIES =====

  /**
   * Get supported payment methods
   */
  getSupportedPaymentMethods(): Array<{
    id: string;
    name: string;
    description: string;
    processingFee?: number;
    isEnabled: boolean;
  }> {
    return [
      {
        id: 'credit_card',
        name: 'Credit Card',
        description: 'Visa, MasterCard, American Express',
        isEnabled: true
      },
      {
        id: 'debit_card',
        name: 'Debit Card',
        description: 'Pay directly from your bank account',
        isEnabled: true
      },
      {
        id: 'paypal',
        name: 'PayPal',
        description: 'Pay with your PayPal account',
        isEnabled: true
      },
      {
        id: 'apple_pay',
        name: 'Apple Pay',
        description: 'Pay with Touch ID or Face ID',
        isEnabled: true
      },
      {
        id: 'google_pay',
        name: 'Google Pay',
        description: 'Pay with Google Pay',
        isEnabled: true
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Direct bank transfer (1-3 business days)',
        processingFee: 0,
        isEnabled: false // Disabled for now
      }
    ];
  }

  /**
   * Validate payment method
   */
  validatePaymentMethod(paymentMethodId: string): boolean {
    const supportedMethods = this.getSupportedPaymentMethods();
    const method = supportedMethods.find(m => m.id === paymentMethodId);
    return method ? method.isEnabled : false;
  }

  // ===== INSTALLMENT CALCULATIONS =====

  /**
   * Calculate installment options for large orders
   */
  calculateInstallmentOptions(orderTotal: number): Array<{
    installments: number;
    monthlyPayment: number;
    totalWithInterest: number;
    interestRate: number;
  }> {
    if (orderTotal < 100) {
      return []; // No installments for small orders
    }

    const options = [
      { installments: 3, interestRate: 0 },
      { installments: 6, interestRate: 0.05 },
      { installments: 12, interestRate: 0.08 }
    ];

    return options.map(option => {
      const totalWithInterest = orderTotal * (1 + option.interestRate);
      const monthlyPayment = totalWithInterest / option.installments;

      return {
        installments: option.installments,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        totalWithInterest: Math.round(totalWithInterest * 100) / 100,
        interestRate: option.interestRate
      };
    });
  }

  // ===== PRIVATE HELPER METHODS =====

  private initializePromotionsCache(): void {
    this.getAvailablePromotions().subscribe();
  }

  private isPromotionsCacheValid(): boolean {
    return Date.now() - this.promotionsCacheTimestamp < this.CACHE_TTL;
  }

  private updatePromotionsCache(promotions: PromotionModel[]): void {
    this.promotionsCache$.next(promotions);
    this.promotionsCacheTimestamp = Date.now();
  }

  // ===== PUBLIC UTILITY METHODS =====

  /**
   * Format currency amount
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  /**
   * Get payment status display text
   */
  getPaymentStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pending',
      'processing': 'Processing',
      'completed': 'Completed',
      'failed': 'Failed',
      'cancelled': 'Cancelled',
      'refunded': 'Refunded',
      'partially_refunded': 'Partially Refunded'
    };
    
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  /**
   * Get payment method display name
   */
  getPaymentMethodDisplayName(methodId: string): string {
    const method = this.getSupportedPaymentMethods().find(m => m.id === methodId);
    return method ? method.name : methodId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Clear promotions cache
   */
  clearPromotionsCache(): void {
    this.promotionsCacheTimestamp = 0;
    this.promotionsCache$.next([]);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    promotionsCacheSize: number;
    promotionsCacheAge: number;
    isPromotionsCacheValid: boolean;
  } {
    return {
      promotionsCacheSize: this.promotionsCache$.value.length,
      promotionsCacheAge: Date.now() - this.promotionsCacheTimestamp,
      isPromotionsCacheValid: this.isPromotionsCacheValid()
    };
  }

  // ===== DEBUGGING METHODS =====

  /**
   * Debug payment service state
   */
  debugPaymentService(): void {
    console.group('[OrderPaymentService] Debug Info');
    console.log('Cache Stats:', this.getCacheStats());
    console.log('Available Promotions:', this.promotionsCache$.value);
    console.log('Supported Payment Methods:', this.getSupportedPaymentMethods());
    console.groupEnd();
  }
}