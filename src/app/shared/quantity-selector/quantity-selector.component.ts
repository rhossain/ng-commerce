import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-quantity-selector',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './quantity-selector.component.html',
  styleUrls: ['./quantity-selector.component.scss']
})
export class QuantitySelectorComponent {
  @Input() productVariantStock: number = 0; // Stock from variant
  @Input() showAvailable: boolean = true;

  quantity: number = 1;

  @Output() quantityChange = new EventEmitter<number>();
  @Output() stockOut = new EventEmitter<void>(); // Emits when stock runs out

  faPlus = faPlus;
  faMinus = faMinus;

  get availableQuantity(): number {
    return this.productVariantStock - this.quantity;
  }

  increase() {
    if (this.quantity < this.productVariantStock) {
      this.quantity++;
      this.quantityChange.emit(this.quantity);

      if (this.availableQuantity === 0) {
        this.stockOut.emit();
      }
    }
  }

  decrease() {
    if (this.quantity > 1) {
      this.quantity--;
      this.quantityChange.emit(this.quantity);
    }
  }

  onInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = parseInt(input.value, 10);

    if (isNaN(value) || value < 1) {
      value = 1;
    } else if (value > this.productVariantStock) {
      value = this.productVariantStock;
    }

    this.quantity = value;
    this.quantityChange.emit(this.quantity);

    if (this.availableQuantity === 0) {
      this.stockOut.emit();
    }
  }

  validateQuantity() {
    if (this.quantity < 1) {
      this.quantity = 1;
    } else if (this.quantity > this.productVariantStock) {
      this.quantity = this.productVariantStock;
    }
    this.quantityChange.emit(this.quantity);
  }

  isIncreaseDisabled(): boolean {
    return this.quantity >= this.productVariantStock;
  }

  isDecreaseDisabled(): boolean {
    return this.quantity <= 1;
  }
}
