import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.component.html',
  styleUrl: './star-rating.component.scss'
})
export class StarRatingComponent {
  @Input() rating: number = 0; // Average rating (e.g., 4.3)
  @Input() reviewCount?: number; // Optional: total number of reviews

  round(value: number): number {
    return Math.round(value);
  }
}
