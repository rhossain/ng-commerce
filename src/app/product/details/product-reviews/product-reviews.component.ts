import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StarRatingComponent } from '../../../shared/star-rating/star-rating.component';
import { RatingSummaryComponent } from '../../../shared/rating-summary/rating-summary.component';

@Component({
  selector: 'app-product-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, StarRatingComponent, RatingSummaryComponent],
  templateUrl: './product-reviews.component.html',
  styleUrls: ['./product-reviews.component.scss']
})
export class ProductReviewsComponent {
  @Input() reviews: any[] = [];
  @Input() userLoggedIn: boolean = false;
  @Input() currentUserId: number | null = null;

  @Output() reviewAdded = new EventEmitter<{ rating: number, text: string }>();
  @Output() reviewUpdated = new EventEmitter<{ reviewId: number, rating: number, text: string }>();
  @Output() reviewDeleted = new EventEmitter<number>();

  newReviewRating: number = 0;
  newReviewText: string = '';

  editingReviewId: number | null = null;
  editableRating: number = 0;
  editableText: string = '';

  submitReview() {
    this.reviewAdded.emit({
      rating: this.newReviewRating,
      text: this.newReviewText.trim()
    });
    this.newReviewRating = 0;
    this.newReviewText = '';
  }

  enableReviewEdit(review: any) {
    this.editingReviewId = review.id;
    this.editableRating = review.rating;
    this.editableText = review.review_text;
  }

  cancelReviewEdit() {
    this.editingReviewId = null;
  }

  updateReview(reviewId: number) {
    this.reviewUpdated.emit({
      reviewId,
      rating: this.editableRating,
      text: this.editableText.trim()
    });
    this.editingReviewId = null;
  }

  deleteReview(reviewId: number) {
    this.reviewDeleted.emit(reviewId);
  }
}
