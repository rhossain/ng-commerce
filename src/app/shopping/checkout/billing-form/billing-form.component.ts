import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEdit } from '@fortawesome/free-solid-svg-icons';
import { Subject, takeUntil } from 'rxjs';
import { UserModel } from '../../../models/user.model';
import { ShippingAddress } from '../../../models/order.model';

@Component({
  selector: 'app-billing-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './billing-form.component.html',
  styleUrl: './billing-form.component.scss'
})
export class BillingFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() currentUser: UserModel | null = null;
  @Input() shippingAddresses: ShippingAddress[] = [];
  @Input() selectedAddress: ShippingAddress | null = null;
  @Input() sameBillingAddress: boolean = true;
  @Input() selectedShippingAddress: ShippingAddress | null = null;

  @Output() addressSelected = new EventEmitter<ShippingAddress>();
  @Output() sameBillingChanged = new EventEmitter<boolean>();
  @Output() validationChanged = new EventEmitter<boolean>();

  // Icons
  faCheck = faCheck;
  faEdit = faEdit;

  billingForm!: FormGroup;
  showAddressForm: boolean = false;

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.setupFormSubscriptions();
    this.initializeWithData();
    this.checkValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.billingForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      company: [''],
      address_line_1: ['', [Validators.required, Validators.minLength(5)]],
      address_line_2: [''],
      city: ['', [Validators.required, Validators.minLength(2)]],
      state: ['', [Validators.required, Validators.minLength(2)]],
      zip_code: ['', [Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
      country: ['US', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-\(\)]{10,}$/)]]
    });
  }

  private setupFormSubscriptions(): void {
    this.billingForm.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkValidation();
      });
  }

  private initializeWithData(): void {
    if (this.sameBillingAddress && this.selectedShippingAddress) {
      this.populateForm(this.selectedShippingAddress);
    } else if (this.selectedAddress) {
      this.populateForm(this.selectedAddress);
    } else if (this.currentUser) {
      // Pre-fill with user data
      const userData = {
        first_name: this.currentUser.first_name || '',
        last_name: this.currentUser.last_name || '',
        address_line_1: this.currentUser.street || '',
        city: this.currentUser.city || '',
        state: this.currentUser.state || '',
        zip_code: this.currentUser.zip_code || '',
        country: 'US'
      };
      this.billingForm.patchValue(userData);
    }
  }

  private populateForm(address: ShippingAddress): void {
    this.billingForm.patchValue({
      first_name: address.first_name,
      last_name: address.last_name,
      company: address.company,
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      country: address.country,
      phone: address.phone
    });
  }

  private checkValidation(): void {
    const isValid = this.sameBillingAddress || this.billingForm.valid || this.selectedAddress !== null;
    this.validationChanged.emit(isValid);
  }

  onSameBillingAddressChange(): void {
    this.sameBillingAddress = !this.sameBillingAddress;
    this.sameBillingChanged.emit(this.sameBillingAddress);
    
    if (this.sameBillingAddress && this.selectedShippingAddress) {
      this.populateForm(this.selectedShippingAddress);
      this.showAddressForm = false;
    } else if (!this.sameBillingAddress) {
      this.showAddressForm = true;
    }
    
    this.checkValidation();
  }

  onAddressSelect(address: ShippingAddress): void {
    this.selectedAddress = address;
    this.populateForm(address);
    this.addressSelected.emit(address);
    this.showAddressForm = false;
    this.checkValidation();
  }

  onShowAddressForm(): void {
    this.showAddressForm = true;
    this.sameBillingAddress = false;
    this.sameBillingChanged.emit(false);
    this.checkValidation();
  }

  onCancelAddressForm(): void {
    this.showAddressForm = false;
    
    if (this.selectedAddress) {
      this.populateForm(this.selectedAddress);
    } else if (this.selectedShippingAddress) {
      this.sameBillingAddress = true;
      this.sameBillingChanged.emit(true);
      this.populateForm(this.selectedShippingAddress);
    }
    
    this.checkValidation();
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.billingForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.billingForm.get(fieldName);
    if (field && field.errors && (field.dirty || field.touched)) {
      if (field.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['pattern']) {
        return `Please enter a valid ${this.getFieldLabel(fieldName).toLowerCase()}`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      first_name: 'First name',
      last_name: 'Last name',
      company: 'Company',
      address_line_1: 'Address',
      address_line_2: 'Address line 2',
      city: 'City',
      state: 'State',
      zip_code: 'ZIP code',
      country: 'Country',
      phone: 'Phone number'
    };
    return labels[fieldName] || fieldName;
  }

  formatAddressDisplay(address: ShippingAddress): string {
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.zip_code,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  private markFormGroupTouched(): void {
    Object.keys(this.billingForm.controls).forEach(key => {
      const control = this.billingForm.get(key);
      control?.markAsTouched();
    });
  }
}