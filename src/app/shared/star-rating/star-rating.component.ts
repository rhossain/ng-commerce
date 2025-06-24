import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.component.html',
  styleUrl: './star-rating.component.scss'
})
export class StarRatingComponent {
  @Input() rating: number = 0; // Can be fractional for summary
  @Input() showRatingText: boolean = false; // Controls whether to display the rating number
  @Input() ratingLabel: string = '';
  @Input() readonly: boolean = true; // Clickable or display-only
  @Input() supportHalfStar: boolean = false; // Enable half-star logic
  @Input() reviewCount?: number; // Optional number of reviews to display
  @Output() ratingChange = new EventEmitter<number>();

  onStarClick(star: number) {
    if (this.readonly) return;
    this.rating = star;
    this.ratingChange.emit(this.rating);
  }

  floor(value: number): number {
    return Math.floor(value);
  }

  ceil(value: number): number {
    return Math.ceil(value);
  }
}
