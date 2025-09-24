import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faEdit, faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Subject, takeUntil } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ShippingService } from '../../../services/shipping.service';
import { AuthService } from '../../../services/auth.service';
import { UserModel } from '../../../models/user.model';
import { ShippingAddress } from '../../../models/order.model';

@Component({
  selector: 'app-shipping-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './shipping-form.component.html',
  styleUrl: './shipping-form.component.scss'
})
export class ShippingFormComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() currentUser: UserModel | null = null;
  @Input() shippingAddresses: ShippingAddress[] = [];
  @Input() selectedAddress: ShippingAddress | null = null;
  @Input() isLoading: boolean = false;

  @Output() addressSelected = new EventEmitter<ShippingAddress>();
  @Output() validationChanged = new EventEmitter<boolean>();

  // Icons
  faPlus = faPlus;
  faEdit = faEdit;
  faCheck = faCheck;
  faSpinner = faSpinner;

  shippingForm!: FormGroup;
  showAddressForm: boolean = false;
  isEditingAddress: boolean = false;
  editingAddressId: number | null = null;
  isSavingAddress: boolean = false;

  constructor(
    private fb: FormBuilder,
    private toastr: ToastrService,
    public shippingService: ShippingService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.setupFormSubscriptions();
    this.initializeWithUserData();
    this.checkValidation();

    // ✅ Add this reactive subscription for immediate updates
    this.shippingService.userAddresses$
      .pipe(takeUntil(this.destroy$))
      .subscribe(addresses => {
        console.log('📍 Addresses updated:', addresses.length);
        this.shippingAddresses = addresses; // Update your component property
        this.cdr.markForCheck(); // Force change detection
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.shippingForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      company: [''],
      address_line_1: ['', [Validators.required, Validators.minLength(5)]],
      address_line_2: [''],
      city: ['', [Validators.required, Validators.minLength(2)]],
      state: [''],
      zip_code: ['', [Validators.required, Validators.pattern(/^\d{4}(-\d{4})?$/)]],
      country: ['BD', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s\-\(\)]{10,}$/)]],
      delivery_instructions: ['']
    });
  }

  private setupFormSubscriptions(): void {
    this.shippingForm.statusChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.checkValidation();
      });
  }

  private initializeWithUserData(): void {
    if (this.selectedAddress) {
      this.populateForm(this.selectedAddress);
    } else if (this.currentUser && this.shippingAddresses.length === 0) {
      // Pre-fill with user data if no addresses exist
      const userData = {
        first_name: this.currentUser.first_name || '',
        last_name: this.currentUser.last_name || '',
        address_line_1: this.currentUser.street || '',
        city: this.currentUser.city || '',
        state: this.currentUser.state || '',
        zip_code: this.currentUser.zip_code || '',
        country: 'BD'
      };
      this.shippingForm.patchValue(userData);
      this.showAddressForm = true;
    }
  }

  private populateForm(address: ShippingAddress): void {
    this.shippingForm.patchValue({
      first_name: address.first_name,
      last_name: address.last_name,
      company: address.company,
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      country: address.country,
      phone: address.phone,
      delivery_instructions: address.delivery_instructions
    });
  }

  private checkValidation(): void {
    const isValid = this.selectedAddress !== null || 
                   (this.showAddressForm && this.shippingForm.valid);
    this.validationChanged.emit(isValid);
  }

  onAddressSelect(address: ShippingAddress): void {
    this.selectedAddress = address;
    this.populateForm(address);
    this.addressSelected.emit(address);
    this.showAddressForm = false;
    this.isEditingAddress = false;
    this.checkValidation();
  }

  onShowAddressForm(): void {
    this.showAddressForm = true;
    this.isEditingAddress = false;
    this.editingAddressId = null;
    this.shippingForm.reset({
      country: 'BD'
    });
    this.checkValidation();
  }

  onEditAddress(address: ShippingAddress): void {
    this.showAddressForm = true;
    this.isEditingAddress = true;
    this.editingAddressId = address.id;
    this.populateForm(address);
    this.checkValidation();
  }

  onSaveAddress(): void {
    if (!this.shippingForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    // Ensure user is logged in
    const currentUserId = this.authService.getUserId();
    if (!currentUserId) {
      this.toastr.error('Please log in to save addresses', 'Authentication Required');
      return;
    }

    this.isSavingAddress = true;
    const addressData = {
      ...this.shippingForm.value,
      user_id: currentUserId // Explicitly set the user_id
    };

    if (this.isEditingAddress && this.editingAddressId) {
      // Update existing address - ensure it belongs to current user
      this.shippingService.updateShippingAddress(this.editingAddressId, addressData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updatedAddress) => {
            // Verify the updated address belongs to current user
            if (updatedAddress.user_id === currentUserId) {
              this.handleSaveSuccess(updatedAddress);
            } else {
              this.toastr.error('Address does not belong to current user', 'Error');
              this.isSavingAddress = false;
            }
          },
          error: () => {
            this.isSavingAddress = false;
          }
        });
    } else {
      // Create new address for current user
      this.shippingService.createShippingAddress(addressData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (newAddress) => {
            // Verify the new address belongs to current user
            if (newAddress.user_id === currentUserId) {
              this.handleSaveSuccess(newAddress);
            } else {
              this.toastr.error('Failed to create address for current user', 'Error');
              this.isSavingAddress = false;
            }
          },
          error: () => {
            this.isSavingAddress = false;
          }
        });
    }
  }

  private handleSaveSuccess(address: ShippingAddress): void {
    this.selectedAddress = address;
    this.addressSelected.emit(address);
    this.showAddressForm = false;
    this.isEditingAddress = false;
    this.editingAddressId = null;
    this.isSavingAddress = false;
    this.checkValidation();
  }

  onCancelAddressForm(): void {
    this.showAddressForm = false;
    this.isEditingAddress = false;
    this.editingAddressId = null;
    
    if (this.selectedAddress) {
      this.populateForm(this.selectedAddress);
    }
    
    this.checkValidation();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.shippingForm.controls).forEach(key => {
      const control = this.shippingForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.shippingForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.shippingForm.get(fieldName);
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
      phone: 'Phone number',
      delivery_instructions: 'Delivery instructions'
    };
    return labels[fieldName] || fieldName;
  }

  formatAddressDisplay(address: ShippingAddress): string {
    return this.shippingService.formatAddressDisplay(address);
  }
}