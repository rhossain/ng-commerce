import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faGift, 
  faSpinner, 
  faCheck, 
  faTimes, 
  faInfoCircle,
  faTruck,
  faShoppingCart
} from '@fortawesome/free-solid-svg-icons';
import { Subject, takeUntil } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { OrderService } from '../../../services/order.service';
import { CartItem } from '../../../models/cart.model';
import { ShippingMethod, PromotionModel } from '../../../models/order.model';
import { CheckoutTotals } from '../checkout-types';

@Component({
  selector: 'app-checkout-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './checkout-summary.component.html',
  styleUrl: './checkout-summary.component.scss'
})
export class CheckoutSummaryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() cartItems: CartItem[] = [];
  @Input() totals!: CheckoutTotals;
  @Input() appliedPromotion: PromotionModel | null = null;
  @Input() selectedShippingMethod: ShippingMethod | null = null;
  @Input() isProcessingOrder: boolean = false;

  @Output() promotionApplied = new EventEmitter<PromotionModel>();
  @Output() promotionRemoved = new EventEmitter<void>();

  // Icons
  faGift = faGift;
  faSpinner = faSpinner;
  faCheck = faCheck;
  faTimes = faTimes;
  faInfoCircle = faInfoCircle;
  faTruck = faTruck;
  faShoppingCart = faShoppingCart;

  // Promotion
  promotionCode: string = '';
  isValidatingPromotion: boolean = false;
  promotionError: string = '';

  // UI State
  showCartItems: boolean = false;
  showPromotionDetails: boolean = false;

  constructor(
    private orderService: OrderService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Auto-expand cart items if few items
    this.showCartItems = this.cartItems.length <= 3;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onApplyPromotionCode(): void {
    if (!this.promotionCode.trim()) {
      this.promotionError = 'Please enter a promotion code';
      return;
    }

    this.isValidatingPromotion = true;
    this.promotionError = '';

    this.orderService.validatePromotionCode(this.promotionCode.trim(), this.totals.cartSubtotal)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (promotion) => {
          this.promotionApplied.emit(promotion);
          this.promotionCode = '';
          this.isValidatingPromotion = false;
          this.showPromotionDetails = true;
        },
        error: (error) => {
          this.isValidatingPromotion = false;
          if (error.status === 404) {
            this.promotionError = 'Invalid promotion code';
          } else if (error.status === 400) {
            this.promotionError = 'Promotion code is not applicable to this order';
          } else {
            this.promotionError = 'Failed to validate promotion code';
          }
        }
      });
  }

  onRemovePromotion(): void {
    this.promotionRemoved.emit();
    this.promotionCode = '';
    this.promotionError = '';
    this.showPromotionDetails = false;
  }

  toggleCartItems(): void {
    this.showCartItems = !this.showCartItems;
  }

  togglePromotionDetails(): void {
    this.showPromotionDetails = !this.showPromotionDetails;
  }

  getItemPrice(item: CartItem): number {
    return item.variant.discountPrice ?? item.variant.price;
  }

  getItemTotal(item: CartItem): number {
    return this.getItemPrice(item) * item.quantity;
  }

  getPromotionDescription(): string {
    if (!this.appliedPromotion) return '';

    switch (this.appliedPromotion.discount_type) {
      case 'percentage':
        return `${this.appliedPromotion.discount_value}% off your order`;
      case 'fixed_amount':
        return `$${this.appliedPromotion.discount_value} off your order`;
      case 'free_shipping':
        return 'Free shipping on this order';
      default:
        return this.appliedPromotion.description || 'Discount applied';
    }
  }

  getEstimatedDeliveryText(): string {
    if (!this.selectedShippingMethod) return '';
    return `Estimated delivery: ${this.selectedShippingMethod.estimated_delivery_days}`;
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  getSavingsAmount(): number {
    return this.totals.discountAmount + (this.appliedPromotion?.discount_type === 'free_shipping' ? this.totals.shippingCost : 0);
  }

  hasSavings(): boolean {
    return this.getSavingsAmount() > 0;
  }
}