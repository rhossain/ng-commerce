import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faTruck, 
  faPlane, 
  faShippingFast,
  faCheck,
  faSpinner,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import { ShippingService } from '../../../services/shipping.service';
import { ShippingMethod } from '../../../models/order.model';

@Component({
  selector: 'app-shipping-method',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './shipping-method.component.html',
  styleUrl: './shipping-method.component.scss'
})
export class ShippingMethodComponent implements OnInit {
  @Input() shippingMethods: ShippingMethod[] = [];
  @Input() selectedMethod: ShippingMethod | null = null;
  @Input() cartSubtotal: number = 0;
  @Input() isLoading: boolean = false;

  @Output() methodSelected = new EventEmitter<ShippingMethod>();
  @Output() validationChanged = new EventEmitter<boolean>();

  // Icons
  faTruck = faTruck;
  faPlane = faPlane;
  faShippingFast = faShippingFast;
  faCheck = faCheck;
  faSpinner = faSpinner;
  faInfoCircle = faInfoCircle;

  constructor(private shippingService: ShippingService) {}

  ngOnInit(): void {
    this.checkValidation();
  }

  onMethodSelect(method: ShippingMethod): void {
    this.selectedMethod = method;
    this.methodSelected.emit(method);
    this.checkValidation();
  }

  private checkValidation(): void {
    this.validationChanged.emit(this.selectedMethod !== null);
  }

  getMethodIcon(method: ShippingMethod): any {
    switch (method.type) {
      case 'standard':
        return this.faTruck;
      case 'express':
        return this.faShippingFast;
      case 'overnight':
        return this.faPlane;
      default:
        return this.faTruck;
    }
  }

  getShippingCost(method: ShippingMethod): number {
    return this.shippingService.calculateShippingCost(
      method.id,
      this.cartSubtotal,
      this.shippingMethods
    );
  }

  isFreeShipping(method: ShippingMethod): boolean {
    return this.getShippingCost(method) === 0 && method.free_shipping_threshold > 0;
  }

  getEstimatedDeliveryDate(method: ShippingMethod): string {
    const deliveryDate = this.shippingService.getEstimatedDeliveryDate(method);
    return deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  getMethodDescription(method: ShippingMethod): string {
    if (method.description) {
      return method.description;
    }
    
    switch (method.type) {
      case 'standard':
        return 'Regular delivery service';
      case 'express':
        return 'Faster delivery for urgent orders';
      case 'overnight':
        return 'Next business day delivery';
      default:
        return 'Delivery service';
    }
  }

  getFreeShippingThresholdMessage(method: ShippingMethod): string {
    if (method.free_shipping_threshold > 0 && this.cartSubtotal < method.free_shipping_threshold) {
      const remaining = method.free_shipping_threshold - this.cartSubtotal;
      return `Free shipping on orders over ${this.formatPrice(method.free_shipping_threshold)} (add ${this.formatPrice(remaining)} more)`;
    }
    return '';
  }
}