import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StarRatingComponent } from '../star-rating/star-rating.component';
import { ProductReview } from '../../models/product.model';

@Component({
  selector: 'app-rating-summary',
  standalone: true,
  imports: [CommonModule, StarRatingComponent],
  templateUrl: './rating-summary.component.html',
  styleUrl: './rating-summary.component.scss'
})
export class RatingSummaryComponent {
  @Input() reviews: ProductReview[] = [];

  get averageRating(): number {
    if (!this.reviews.length) return 0;
    const total = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    return total / this.reviews.length;
  }

  get totalReviews(): number {
    return this.reviews.length;
  }

  get ratingDistribution(): { [key: number]: number } {
    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.reviews.forEach(review => distribution[review.rating]++);
    return distribution;
  }

  get ratingPercentages(): { [key: number]: number } {
    const total = this.reviews.length || 1; // Avoid division by zero
    const distribution = this.ratingDistribution;
    return {
      5: Math.round((distribution[5] / total) * 100),
      4: Math.round((distribution[4] / total) * 100),
      3: Math.round((distribution[3] / total) * 100),
      2: Math.round((distribution[2] / total) * 100),
      1: Math.round((distribution[1] / total) * 100),
    };
  }
}
