import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCodeCompare, faHeart } from '@fortawesome/free-solid-svg-icons';
import { StarRatingComponent } from '../../../shared/star-rating/star-rating.component';
import { QuantitySelectorComponent } from '../../../shared/quantity-selector/quantity-selector.component';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule, StarRatingComponent, QuantitySelectorComponent, RouterModule, FontAwesomeModule],
  templateUrl: './product-info.component.html',
  styleUrls: ['./product-info.component.scss']
})
export class ProductInfoComponent {
  @Input() product: any;
  @Input() productId: number = 0; // Add this for unique radio button names
  @Input() categoryName: string = '';
  @Input() selectedVariant: any;
  @Input() avgRating: number = 0;
  @Input() groupedOptions: any = {};
  @Input() selectedOptions: any = {};
  @Input() selectedQuantity: number = 1;
  @Input() displayPrice: number = 0;

  @Output() optionSelected = new EventEmitter<{ optionName: string, optionValue: string }>();
  @Output() quantityChanged = new EventEmitter<number>();
  @Output() addToCartClicked = new EventEmitter<void>();

  faCodeCompare = faCodeCompare;
  faHeart = faHeart;

  constructor(
      private toastr: ToastrService
  ) {}

  onOptionSelect(optionName: string, value: string) {
    this.optionSelected.emit({ optionName, optionValue: value });
  }

  onQuantityChange(newQuantity: number) {
    this.selectedQuantity = newQuantity;
    this.quantityChanged.emit(newQuantity);
  }

  onStockOut() {
    this.toastr.warning('Stock is fully reserved!');
  }

  addToCart() {
    if (!this.selectedVariant) {
      this.toastr.warning('Please select a product variant first');
      return;
    }
    
    if (!this.isInStock()) {
      this.toastr.warning('Product is out of stock');
      return;
    }

    this.addToCartClicked.emit();
  }

  isInStock(): boolean {
    return this.selectedVariant?.stock > 0;
  }

  getOptionNames(): string[] {
    return Object.keys(this.groupedOptions || {});
  }
}