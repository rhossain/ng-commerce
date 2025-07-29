import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
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
    private shippingService: ShippingService
  ) {}

  ngOnInit(): void {
    this.checkAuthentication();
    this.loadCartItems();
    this.loadUserData();
    this.loadShippingData();
    this.calculateTotals();
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

    // Ensure user is logged in before loading addresses
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
          // Double-check that addresses belong to current user
          this.shippingAddresses = addresses.filter(address => address.user_id === currentUserId);
          this.selectedShippingAddress = this.shippingAddresses.find(a => a.is_active) || this.shippingAddresses[0] || null;
          this.isLoadingAddresses = false;
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
  }

  onBillingAddressSelected(address: ShippingAddress): void {
    this.selectedBillingAddress = address;
  }

  onSameBillingAddressChanged(same: boolean): void {
    this.sameBillingAddress = same;
    this.validateOrder();
  }

  // Shipping Method Events
  onShippingMethodSelected(method: ShippingMethod): void {
    this.selectedShippingMethod = method;
    this.calculateShippingCost();
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

  // Order Processing
  async processOrder(): Promise<void> {
    if (!this.isOrderValid || this.isProcessingOrder) {
      return;
    }

    this.isProcessingOrder = true;

    try {
      // Create shipping address if new
      let shippingAddressId = this.selectedShippingAddress?.id;
      
      // Prepare order items
      const orderItems: OrderItemRequest[] = this.cartItems.map(item => ({
        product_id: item.product.id,
        variant_id: item.variant.id,
        quantity: item.quantity,
        unit_price: item.variant.discountPrice ?? item.variant.price
      }));

      // Create order request
      const orderRequest: CreateOrderRequest = {
        shipping_address_id: shippingAddressId || null,
        shipping_method_id: this.selectedShippingMethod?.id || null,
        payment_method: this.selectedPaymentMethod?.id,
        items: orderItems,
        promotion_code: this.appliedPromotion?.code || null,
        delivery_instructions: null,
        notes: this.orderNotes || null
      };

      // Create order
      const order = await this.orderService.createOrder(orderRequest).toPromise();
      
      if (order) {
        // Process payment
        await this.processPayment(order);
        
        // Clear cart
        this.cartService.clearCart();
        
        // Redirect to success page
        this.router.navigate(['/order/success'], { 
          queryParams: { orderId: order.id } 
        });
      }

    } catch (error) {
      console.error('Order processing failed:', error);
      this.toastr.error('Failed to process order. Please try again.');
    } finally {
      this.isProcessingOrder = false;
    }
  }

  private async processPayment(order: OrderModel): Promise<void> {
    if (!this.selectedPaymentMethod || !order) {
      throw new Error('Missing payment method or order');
    }

    const paymentRequest: PaymentRequest = {
      order_id: order.id,
      payment_method: this.selectedPaymentMethod.id,
      amount: this.orderTotal,
      currency: 'USD',
      gateway_data: {}
    };

    await this.orderService.processPayment(paymentRequest).toPromise();
  }

  // Calculation Methods
  private calculateShippingCost(): void {
    if (this.selectedShippingMethod) {
      this.shippingCost = this.shippingService.calculateShippingCost(
        this.selectedShippingMethod.id,
        this.cartSubtotal,
        this.shippingMethods
      );
      this.calculateTotals();
    }
  }

  private calculateTotals(): void {
    // Calculate cart subtotal
    this.cartSubtotal = this.cartItems.reduce((total, item) => {
      const price = item.variant.discountPrice ?? item.variant.price;
      return total + (price * item.quantity);
    }, 0);

    // Calculate tax (8% tax rate)
    const taxRate = 0.08;
    this.taxAmount = this.cartSubtotal * taxRate;

    // Calculate order total
    this.orderTotal = this.orderService.calculateOrderTotal(
      this.cartSubtotal,
      this.shippingCost,
      taxRate,
      this.discountAmount
    );

    this.validateOrder();
  }

  private validateOrder(): void {
    this.isOrderValid = 
      this.cartItems.length > 0 &&
      this.stepValidation.shipping &&
      this.stepValidation.shippingMethod &&
      (this.sameBillingAddress || this.stepValidation.billing) &&
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
}