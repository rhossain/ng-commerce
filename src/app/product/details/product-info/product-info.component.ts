import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCodeCompare, faHeart } from '@fortawesome/free-solid-svg-icons';
import { StarRatingComponent } from '../../../shared/star-rating/star-rating.component';
import { QuantitySelectorComponent } from '../../../shared/quantity-selector/quantity-selector.component';
import { CharInitialsPipe } from "../../../shared/char-initials.pipe";
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule, StarRatingComponent, QuantitySelectorComponent, RouterModule, FontAwesomeModule, CharInitialsPipe],
  templateUrl: './product-info.component.html',
  styleUrls: ['./product-info.component.scss']
})
export class ProductInfoComponent {
  @Input() product: any;
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
  }

  onStockOut() {
    this.toastr.warning('Stock is fully reserved!');
  }

  addToCart() {
    this.addToCartClicked.emit();
  }

  isInStock(): boolean {
    return this.selectedVariant?.stock > 0;
  }

  getOptionNames(): string[] {
    return Object.keys(this.groupedOptions || {});
  }
}
