import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

// FontAwesome icons
import { 
  faCreditCard, 
  faAppleWhole
} from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faPaypal } from '@fortawesome/free-brands-svg-icons';

// Services
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { ShippingService } from '../../services/shipping.service';
import { PricingService } from '../../services/pricing.service';

// Models
import { CartItem } from '../../models/cart.model';
import { UserModel } from '../../models/user.model';
import { 
  OrderModel, 
  CreateOrderRequest, 
  OrderItemRequest,
  ShippingAddress, 
  ShippingMethod,
  PaymentRequest,
  PromotionModel
} from '../../models/order.model';

// Child Components
import { CheckoutStepsComponent } from './checkout-steps/checkout-steps.component';
import { CheckoutSummaryComponent } from './checkout-summary/checkout-summary.component';
import { ShippingFormComponent } from './shipping-form/shipping-form.component';
import { BillingFormComponent } from './billing-form/billing-form.component';
import { ShippingMethodComponent } from './shipping-method/shipping-method.component';
import { PaymentFormComponent } from './payment-form/payment-form.component';

// Shared types
import { PaymentMethod, CheckoutTotals, StepValidation } from './checkout-types';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    CheckoutStepsComponent,
    CheckoutSummaryComponent,
    ShippingFormComponent,
    BillingFormComponent,
    ShippingMethodComponent,
    PaymentFormComponent
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export default class CheckoutComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ViewChild references for accessing form data
  @ViewChild(PaymentFormComponent) paymentFormComponent!: PaymentFormComponent;
  @ViewChild(ShippingFormComponent) shippingFormComponent!: ShippingFormComponent;
  @ViewChild(BillingFormComponent) billingFormComponent!: BillingFormComponent;

  // Icons
  faCreditCard = faCreditCard;
  faAppleWhole = faAppleWhole;
  faGoogle = faGoogle;
  faPaypal = faPaypal;

  // Payment methods
  paymentMethods: PaymentMethod[] = [
    {
      id: 'credit_card',
      name: 'Credit/Debit Card',
      icon: this.faCreditCard,
      description: 'Visa, Mastercard, American Express',
      type: 'card'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: this.faPaypal,
      description: 'Pay with your PayPal account',
      type: 'digital_wallet'
    },
    {
      id: 'apple_pay',
      name: 'Apple Pay',
      icon: this.faAppleWhole,
      description: 'Pay with Touch ID or Face ID',
      type: 'digital_wallet'
    },
    {
      id: 'google_pay',
      name: 'Google Pay',
      icon: this.faGoogle,
      description: 'Pay with Google Pay',
      type: 'digital_wallet'
    }
  ];

  // Data
  cartItems: CartItem[] = [];
  currentUser: UserModel | null = null;
  shippingAddresses: ShippingAddress[] = [];
  shippingMethods: ShippingMethod[] = [];
  
  // Selected options
  selectedShippingAddress: ShippingAddress | null = null;
  selectedBillingAddress: ShippingAddress | null = null;
  selectedShippingMethod: ShippingMethod | null = null;
  selectedPaymentMethod: PaymentMethod | null = null;

  // Checkout steps
  currentStep: number = 1;
  completedSteps: Set<number> = new Set();

  // Order totals
  cartSubtotal: number = 0;
  shippingCost: number = 0;
  taxAmount: number = 0;
  discountAmount: number = 0;
  orderTotal: number = 0;

  // Promotion
  appliedPromotion: PromotionModel | null = null;

  // Checkout options
  sameBillingAddress: boolean = true;
  orderNotes: string = '';

  // Processing states
  isProcessingOrder: boolean = false;
  isLoadingAddresses: boolean = false;
  isLoadingShippingMethods: boolean = false;

  // Validation
  isOrderValid: boolean = false;
  stepValidation: StepValidation = {
    shipping: false,
    billing: false,
    shippingMethod: false,
    payment: false
  };

  constructor(
    private router: Router,
    private toastr: ToastrService,
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private shippingService: ShippingService,
    private pricingService: PricingService
  ) {}

  ngOnInit(): void {
    this.checkAuthentication();
    this.loadCartItems();
    this.loadUserData();
    this.loadShippingData();
    this.calculateTotals();
    
    // Set default payment method
    if (this.paymentMethods.length > 0) {
      this.selectedPaymentMethod = this.paymentMethods[0];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkAuthentication(): void {
    if (!this.authService.isLoggedIn()) {
      this.toastr.warning('Please log in to continue with checkout');
      this.router.navigate(['/auth/login'], { 
        queryParams: { returnUrl: '/checkout' } 
      });
      return;
    }
    this.currentUser = this.authService.getCurrentUserSync();
  }

  private loadCartItems(): void {
    this.cartService.cartItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        this.cartItems = items;
        if (items.length === 0) {
          this.toastr.info('Your cart is empty');
          this.router.navigate(['/cart']);
          return;
        }
        this.calculateTotals();
      });
  }

  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUserSync();
  }

  private loadShippingData(): void {
    this.isLoadingAddresses = true;
    this.isLoadingShippingMethods = true;

    if (!this.authService.isLoggedIn()) {
      this.isLoadingAddresses = false;
      this.isLoadingShippingMethods = false;
      return;
    }

    const currentUserId = this.authService.getUserId();
    
    // Load current user's shipping addresses only
    this.shippingService.getUserShippingAddresses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (addresses) => {
          this.shippingAddresses = addresses.filter(address => address.user_id === currentUserId);
          this.selectedShippingAddress = this.shippingAddresses.find(a => a.is_active) || this.shippingAddresses[0] || null;
          this.isLoadingAddresses = false;
          this.validateOrder();
        },
        error: (error) => {
          console.error('Error loading user addresses:', error);
          this.shippingAddresses = [];
          this.isLoadingAddresses = false;
        }
      });

    // Load shipping methods
    this.shippingService.getShippingMethods()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (methods) => {
          this.shippingMethods = methods;
          this.selectedShippingMethod = methods.find(m => m.type === 'standard') || methods[0] || null;
          this.calculateShippingCost();
          this.isLoadingShippingMethods = false;
          this.validateOrder();
        },
        error: () => {
          this.isLoadingShippingMethods = false;
        }
      });
  }

  // Step Navigation
  onStepChanged(step: number): void {
    this.currentStep = step;
  }

  onStepCompleted(step: number): void {
    this.completedSteps.add(step);
  }

  // Form Validation Events
  onShippingValidation(isValid: boolean): void {
    this.stepValidation.shipping = isValid;
    this.validateOrder();
  }

  onBillingValidation(isValid: boolean): void {
    this.stepValidation.billing = isValid;
    this.validateOrder();
  }

  onShippingMethodValidation(isValid: boolean): void {
    this.stepValidation.shippingMethod = isValid;
    this.validateOrder();
  }

  onPaymentValidation(isValid: boolean): void {
    this.stepValidation.payment = isValid;
    this.validateOrder();
  }

  // Address Events
  onShippingAddressSelected(address: ShippingAddress): void {
    this.selectedShippingAddress = address;
    this.calculateShippingCost();
    this.validateOrder();
  }

  onBillingAddressSelected(address: ShippingAddress): void {
    this.selectedBillingAddress = address;
    this.validateOrder();
  }

  onSameBillingAddressChanged(same: boolean): void {
    this.sameBillingAddress = same;
    if (same) {
      this.selectedBillingAddress = this.selectedShippingAddress;
    }
    this.validateOrder();
  }

  // Shipping Method Events
  onShippingMethodSelected(method: ShippingMethod): void {
    this.selectedShippingMethod = method;
    this.calculateShippingCost();
    this.validateOrder();
  }

  // Payment Events
  onPaymentMethodSelected(method: PaymentMethod): void {
    this.selectedPaymentMethod = method;
    this.validateOrder();
  }

  // Promotion Events
  onPromotionApplied(promotion: PromotionModel): void {
    this.appliedPromotion = promotion;
    this.discountAmount = this.orderService.calculateDiscount(promotion, this.cartSubtotal);
    
    if (promotion.discount_type === 'free_shipping') {
      this.shippingCost = 0;
    }
    
    this.calculateTotals();
  }

  onPromotionRemoved(): void {
    this.appliedPromotion = null;
    this.discountAmount = 0;
    this.calculateShippingCost();
    this.calculateTotals();
  }

  // Order Processing - UPDATED WITH COMPREHENSIVE ERROR HANDLING AND VALIDATION
  async processOrder(): Promise<void> {
    if (!this.validateAllForms()) {
      this.toastr.error('Please complete all required information', 'Validation Error');
      return;
    }

    if (this.isProcessingOrder) {
      return;
    }

    this.isProcessingOrder = true;
    console.log('Starting order processing...');

    try {
      // Validate required selections
      if (!this.selectedShippingAddress) {
        throw new Error('Please select a shipping address');
      }
      
      if (!this.selectedShippingMethod) {
        throw new Error('Please select a shipping method');
      }
      
      if (!this.selectedPaymentMethod) {
        throw new Error('Please select a payment method');
      }
      
      if (this.cartItems.length === 0) {
        throw new Error('Your cart is empty');
      }

      // DEBUG: Log cart items before mapping
      console.log('Raw cart items:', this.cartItems);
      console.log('Cart items structure:', this.cartItems.map(item => ({
        product_id: item.product?.id,
        variant_id: item.variant?.id,
        quantity: item.quantity,
        product: item.product,
        variant: item.variant
      })));

      // Prepare order items with proper pricing
      const orderItems: OrderItemRequest[] = this.cartItems.map(item => {
        const effectivePrice = this.pricingService.getEffectivePrice(item.variant);
        const orderItem = {
          product_id: item.product.id,
          product_variant_id: item.variant.id,
          quantity: item.quantity,
          unit_price: effectivePrice
        };
        
        // DEBUG: Log each order item
        console.log('Mapped order item:', orderItem);
        return orderItem;
      });

      console.log('Final order items array:', orderItems);

      // Create order request with all required fields
      const orderRequest: CreateOrderRequest = {
        shipping_address_id: this.selectedShippingAddress.id,
        shipping_method_id: this.selectedShippingMethod.id,
        payment_method: this.selectedPaymentMethod.id,
        items: orderItems,
        promotion_code: this.appliedPromotion?.code || null,
        delivery_instructions: this.selectedShippingAddress.delivery_instructions || null,
        notes: this.orderNotes || null
      };

      // DEBUG: Log the complete request payload
      console.log('Complete order request payload:', JSON.stringify(orderRequest, null, 2));

      // Create the order
      const createdOrder = await firstValueFrom(this.orderService.createOrder(orderRequest));
      
      console.log('Order created successfully:', createdOrder);
      
      // DEBUG: Check if order_items were returned
      if (!createdOrder.order_items || createdOrder.order_items.length === 0) {
        console.error('❌ ORDER ITEMS NOT CREATED OR RETURNED!');
        console.error('Backend did not create or return order_items');
        console.error('Expected items:', orderItems);
        console.error('Received order:', createdOrder);
      } else {
        console.log('✅ Order items created successfully:', createdOrder.order_items);
      }
      
      if (!createdOrder || !createdOrder.id) {
        throw new Error('Order creation failed - no order ID returned');
      }

      // Continue with payment processing...
      if (this.selectedPaymentMethod.id === 'credit_card') {
        await this.processCreditCardPayment(createdOrder);
      } else {
        await this.processDigitalWalletPayment(createdOrder);
      }

      // Use the promotion if one was applied
      if (this.appliedPromotion) {
        this.orderService.usePromotion(this.appliedPromotion.code);
      }

      // Clear cart after successful order
      this.cartService.clearCart();

      // Navigate to order confirmation
      this.router.navigate(['/checkout/success'], {
        queryParams: { orderId: createdOrder.id }
      });

      this.toastr.success('Order placed successfully!', 'Success');

    } catch (error: any) {
      console.error('Order processing failed:', error);
      this.handleOrderError(error);
    } finally {
      this.isProcessingOrder = false;
    }
  }

  private async processCreditCardPayment(order: OrderModel): Promise<void> {
    if (!this.paymentFormComponent || !this.paymentFormComponent.paymentForm.valid) {
      throw new Error('Invalid payment information');
    }

    const formValue = this.paymentFormComponent.paymentForm.value;
    
    const paymentData: PaymentRequest = {
      order_id: order.id,
      payment_method: 'credit_card',
      amount: order.total_amount,
      currency: 'USD',
      gateway_data: {
        card_number: formValue.card_number,
        expiry_date: `${formValue.expiry_month}/${formValue.expiry_year}`,
        cvv: formValue.cvv,
        cardholder_name: formValue.cardholder_name,
        billing_address: this.getBillingAddressData()
      }
    };

    const payment = await firstValueFrom(this.orderService.processPayment(paymentData));
    
    if (!payment || (payment.status !== 'completed' && payment.status !== 'processing')) {
      throw new Error(`Payment failed: ${payment?.failure_reason || 'Unknown error'}`);
    }

    console.log('Payment processed successfully:', payment);
  }

  private async processDigitalWalletPayment(order: OrderModel): Promise<void> {
    const paymentData: PaymentRequest = {
      order_id: order.id,
      payment_method: this.selectedPaymentMethod!.id,
      amount: order.total_amount,
      currency: 'USD',
      gateway_data: {}
    };

    // For digital wallets, you would typically redirect to the payment provider
    // or use their JavaScript SDK. For now, we'll simulate the process.
    const payment = await firstValueFrom(this.orderService.processPayment(paymentData));
    
    if (!payment || (payment.status !== 'completed' && payment.status !== 'processing')) {
      throw new Error(`Payment failed: ${payment?.failure_reason || 'Unknown error'}`);
    }

    console.log('Digital wallet payment processed successfully:', payment);
  }

  private getBillingAddressData(): any {
    const billingAddress = this.sameBillingAddress ? this.selectedShippingAddress : this.selectedBillingAddress;
    
    if (!billingAddress) {
      return {};
    }

    return {
      first_name: billingAddress.first_name,
      last_name: billingAddress.last_name,
      address_line_1: billingAddress.address_line_1,
      address_line_2: billingAddress.address_line_2,
      city: billingAddress.city,
      state: billingAddress.state,
      zip_code: billingAddress.zip_code,
      country: billingAddress.country
    };
  }

  private handleOrderError(error: any): void {
    let errorMessage = 'Failed to process order. Please try again.';
    
    if (error.status === 400) {
      errorMessage = error.error?.message || 'Invalid order data. Please check your information.';
    } else if (error.status === 401) {
      errorMessage = 'Please log in to place an order.';
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: '/checkout' }
      });
      return;
    } else if (error.status === 409) {
      errorMessage = 'Some items in your cart are no longer available. Please review your cart.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    this.toastr.error(errorMessage, 'Order Failed');
  }

  private validateAllForms(): boolean {
    const hasValidShipping = this.selectedShippingAddress !== null;
    const hasValidShippingMethod = this.selectedShippingMethod !== null;
    const hasValidBilling = this.sameBillingAddress || this.selectedBillingAddress !== null;
    const hasValidPayment = this.selectedPaymentMethod !== null && this.stepValidation.payment;
    
    if (!hasValidShipping) {
      this.toastr.error('Please select or add a shipping address', 'Shipping Address Required');
      return false;
    }
    
    if (!hasValidShippingMethod) {
      this.toastr.error('Please select a shipping method', 'Shipping Method Required');
      return false;
    }
    
    if (!hasValidBilling) {
      this.toastr.error('Please select or add a billing address', 'Billing Address Required');
      return false;
    }
    
    if (!hasValidPayment) {
      this.toastr.error('Please complete payment information', 'Payment Information Required');
      return false;
    }
    
    if (this.cartItems.length === 0) {
      this.toastr.error('Your cart is empty', 'Cart Empty');
      return false;
    }

    return true;
  }

  // Calculation Methods
  private calculateShippingCost(): void {
    if (this.selectedShippingMethod) {
      // Check if free shipping applies from promotion
      if (this.appliedPromotion?.discount_type === 'free_shipping') {
        this.shippingCost = 0;
      } else {
        this.shippingCost = this.shippingService.calculateShippingCost(
          this.selectedShippingMethod.id,
          this.cartSubtotal,
          this.shippingMethods
        );
      }
      this.calculateTotals();
    }
  }

  private calculateTotals(): void {
    // Calculate cart subtotal using PricingService for consistent pricing
    this.cartSubtotal = 0;
    for (const item of this.cartItems) {
      const effectivePrice = this.pricingService.getEffectivePrice(item.variant);
      this.cartSubtotal += effectivePrice * item.quantity;
    }

    // Calculate tax (8% tax rate)
    const taxRate = 0.08;
    this.taxAmount = this.cartSubtotal * taxRate;

    // Calculate order total
    // Calculate order total - get the correct property from the returned object
    const orderCalculation = this.orderService.calculateOrderTotal(
      this.cartSubtotal,
      this.shippingCost,
      taxRate,
      this.appliedPromotion
    );

    this.orderTotal = orderCalculation.total;
    // You can also use other properties:
    this.taxAmount = orderCalculation.tax;
    this.discountAmount = orderCalculation.discount;
    this.shippingCost = orderCalculation.shipping;

    // Apply promotion discount if applicable
    if (this.appliedPromotion?.discount_type === 'free_shipping') {
      this.shippingCost = orderCalculation.shipping; // Will be 0 for free shipping
    }

    this.validateOrder();
  }

  private validateOrder(): void {
    this.isOrderValid = 
      this.cartItems.length > 0 &&
      this.selectedShippingAddress !== null &&
      this.selectedShippingMethod !== null &&
      (this.sameBillingAddress || this.selectedBillingAddress !== null) &&
      this.selectedPaymentMethod !== null &&
      this.stepValidation.payment;
  }

  // Getters for child components
  get checkoutTotals(): CheckoutTotals {
    return {
      cartSubtotal: this.cartSubtotal,
      shippingCost: this.shippingCost,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      orderTotal: this.orderTotal
    };
  }

  /**
   * Get cart items with pricing details for display
   */
  getCartItemsWithPricing() {
    return this.cartItems.map(item => ({
      ...item,
      effectivePrice: this.pricingService.getEffectivePrice(item.variant),
      hasDiscount: this.pricingService.hasValidDiscount(item.variant),
      originalPrice: this.pricingService.getOriginalPrice(item.variant),
      discountPrice: this.pricingService.getDiscountPrice(item.variant),
      savings: this.pricingService.getVariantPricingInfo(item.variant).savings * item.quantity
    }));
  }

  /**
   * Get total savings from all cart items
   */
  getTotalCartSavings(): number {
    let totalSavings = 0;
    for (const item of this.cartItems) {
      const pricingInfo = this.pricingService.getVariantPricingInfo(item.variant);
      totalSavings += pricingInfo.savings * item.quantity;
    }
    return totalSavings;
  }

  /**
   * Check if cart has any discounted items
   */
  hasDiscountedItems(): boolean {
    return this.cartItems.some(item => this.pricingService.hasValidDiscount(item.variant));
  }

  /**
   * Get formatted currency string
   */
  formatCurrency(amount: number): string {
    return this.orderService.formatCurrency(amount);
  }

  /**
   * Debug method to log current checkout state
   */
  debugCheckoutState(): void {
    console.group('Checkout State Debug');
    console.log('Current User:', this.currentUser);
    console.log('Cart Items:', this.cartItems.length);
    console.log('Selected Shipping Address:', this.selectedShippingAddress);
    console.log('Selected Shipping Method:', this.selectedShippingMethod);
    console.log('Selected Payment Method:', this.selectedPaymentMethod);
    console.log('Order Totals:', this.checkoutTotals);
    console.log('Step Validation:', this.stepValidation);
    console.log('Is Order Valid:', this.isOrderValid);
    console.groupEnd();
  }
}