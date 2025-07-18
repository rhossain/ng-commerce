import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faCreditCard, 
  faLock, 
  faShield,
  faAppleWhole,
  faCheck,
  faInfoCircle,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faPaypal } from '@fortawesome/free-brands-svg-icons';
import { Subject, takeUntil } from 'rxjs';
import { UserModel } from '../../../models/user.model';
import { PaymentMethod } from '../checkout-types';

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss'
})
export class PaymentFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() selectedPaymentMethod: PaymentMethod | null = null;
  @Input() currentUser: UserModel | null = null;
  @Input() orderTotal: number = 0;

  @Output() paymentMethodSelected = new EventEmitter<PaymentMethod>();
  @Output() validationChanged = new EventEmitter<boolean>();

  // Icons
  faCreditCard = faCreditCard;
  faLock = faLock;
  faShield = faShield;
  faAppleWhole = faAppleWhole;
  faGoogle = faGoogle;
  faPaypal = faPaypal;
  faCheck = faCheck;
  faInfoCircle = faInfoCircle;
  faEye = faEye;
  faEyeSlash = faEyeSlash;

  paymentForm!: FormGroup;
  showCvv: boolean = false;
  saveCardInfo: boolean = false;

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

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.setupFormSubscriptions();
    this.initializeWithUserData();
    
    // Select credit card by default
    if (!this.selectedPaymentMethod) {
      this.onPaymentMethodSelect(this.paymentMethods[0]);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.paymentForm = this.fb.group({
      card_number: ['', [Validators.required, this.cardNumberValidator]],
      expiry_month: ['', [Validators.required, Validators.min(1), Validators.max(12)]],
      expiry_year: ['', [Validators.required, this.expiryYearValidator]],
      cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
      cardholder_name: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  private setupFormSubscriptions(): void {
    this.paymentForm.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkValidation();
      });

    // Format card number as user types
    this.paymentForm.get('card_number')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (value) {
          const formatted = this.formatCardNumber(value);
          if (formatted !== value) {
            this.paymentForm.get('card_number')?.setValue(formatted, { emitEvent: false });
          }
        }
      });
  }

  private initializeWithUserData(): void {
    if (this.currentUser) {
      this.paymentForm.patchValue({
        cardholder_name: `${this.currentUser.first_name} ${this.currentUser.last_name}`.trim()
      });
    }
  }

  private checkValidation(): void {
    let isValid = false;
    
    if (this.selectedPaymentMethod) {
      if (this.selectedPaymentMethod.id === 'credit_card') {
        isValid = this.paymentForm.valid;
      } else {
        // Digital wallets don't need form validation
        isValid = true;
      }
    }
    
    this.validationChanged.emit(isValid);
  }

  onPaymentMethodSelect(method: PaymentMethod): void {
    this.selectedPaymentMethod = method;
    this.paymentMethodSelected.emit(method);
    this.checkValidation();
  }

  onSaveCardInfoChange(): void {
    this.saveCardInfo = !this.saveCardInfo;
  }

  toggleCvvVisibility(): void {
    this.showCvv = !this.showCvv;
  }

  // Custom Validators
  private cardNumberValidator(control: any) {
    if (!control.value) return null;
    
    const cardNumber = control.value.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cardNumber)) {
      return { invalidCard: true };
    }
    
    // Luhn algorithm validation
    if (!PaymentFormComponent.luhnCheck(cardNumber)) {
      return { invalidCard: true };
    }
    
    return null;
  }

  private expiryYearValidator(control: any) {
    if (!control.value) return null;
    
    const currentYear = new Date().getFullYear();
    const year = parseInt(control.value);
    
    if (year < currentYear || year > currentYear + 20) {
      return { invalidYear: true };
    }
    
    return null;
  }

  // Static methods
  private static luhnCheck(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i));
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  // Utility methods
  private formatCardNumber(value: string): string {
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, '');
    
    // Add spaces every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    return formatted.substring(0, 23); // Limit to 19 digits + 4 spaces
  }

  getCardType(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\s/g, '');
    
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6/.test(cleaned)) return 'discover';
    
    return 'unknown';
  }

  getCardTypeIcon(cardNumber: string): string {
    const type = this.getCardType(cardNumber);
    return `/assets/images/cards/${type}.png`;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.paymentForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.paymentForm.get(fieldName);
    if (field && field.errors && (field.dirty || field.touched)) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (field.errors['invalidCard']) {
        return 'Please enter a valid card number';
      }
      if (field.errors['invalidYear']) {
        return 'Please enter a valid expiry year';
      }
      if (field.errors['pattern']) {
        return `Please enter a valid ${this.getFieldLabel(fieldName).toLowerCase()}`;
      }
      if (field.errors['min'] || field.errors['max']) {
        return `Please enter a valid ${this.getFieldLabel(fieldName).toLowerCase()}`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      card_number: 'Card number',
      expiry_month: 'Expiry month',
      expiry_year: 'Expiry year',
      cvv: 'CVV',
      cardholder_name: 'Cardholder name'
    };
    return labels[fieldName] || fieldName;
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  getMonths(): number[] {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }

  getYears(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, i) => currentYear + i);
  }

  isDigitalWallet(method: PaymentMethod): boolean {
    return method.type === 'digital_wallet';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.paymentForm.controls).forEach(key => {
      const control = this.paymentForm.get(key);
      control?.markAsTouched();
    });
  }

  isApplePayAvailable(): boolean {
    // Check if Apple Pay is available in the browser
    return typeof window !== 'undefined' && 
           'ApplePaySession' in window && 
           (window as any).ApplePaySession?.canMakePayments();
  }
}