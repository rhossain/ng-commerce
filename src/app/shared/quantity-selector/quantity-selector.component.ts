import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-quantity-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quantity-selector.component.html',
  styleUrls: ['./quantity-selector.component.scss']
})
export class QuantitySelectorComponent {
  @Input() quantity: number = 1;
  @Input() min: number = 1;
  @Input() max: number = 99;

  @Output() quantityChange = new EventEmitter<number>();

  constructor(private toastr: ToastrService) {}

  increase() {
    if (this.quantity < this.max) {
      this.quantity++;
      this.quantityChange.emit(this.quantity);
    } else {
      this.toastr.warning(`Maximum allowed quantity is ${this.max}`, 'Limit Reached');
    }
  }

  decrease() {
    if (this.quantity > this.min) {
      this.quantity--;
      this.quantityChange.emit(this.quantity);
    } else {
      this.toastr.warning(`Minimum allowed quantity is ${this.min}`, 'Limit Reached');
    }
  }

  onInputChange(event: any) {
    const value = Number(event.target.value);
    if (!isNaN(value)) {
      this.quantity = value;
      this.quantityChange.emit(this.quantity);
    }
  }

  validateQuantity() {
    if (this.quantity < this.min) {
      this.quantity = this.min;
      this.quantityChange.emit(this.quantity);
      this.toastr.warning(`Minimum allowed quantity is ${this.min}`, 'Limit Reached');
    } else if (this.quantity > this.max) {
      this.quantity = this.max;
      this.quantityChange.emit(this.quantity);
      this.toastr.warning(`Maximum allowed quantity is ${this.max}`, 'Limit Reached');
    }
  }
}
