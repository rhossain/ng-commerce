import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgxImageZoomModule } from 'ngx-image-zoom';
import { MdbTabsModule } from 'mdb-angular-ui-kit/tabs';
import { MdbTooltipModule } from 'mdb-angular-ui-kit/tooltip';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFacebookF, faInstagram, faXTwitter, faPinterestP, faLinkedinIn } from '@fortawesome/free-brands-svg-icons';
import { faCodeCompare, faEnvelope, faHeart, faPrint } from '@fortawesome/free-solid-svg-icons';
import { environment } from '../../../environments/environment';
import { ProductImageModel, ProductModel, ProductOption, ProductOptionValue, ProductVariant, ProductReview } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { StarRatingComponent } from "../../shared/star-rating/star-rating.component";
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { RatingSummaryComponent } from "../../shared/rating-summary/rating-summary.component";
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart.model';
import { QuantitySelectorComponent } from "../../shared/quantity-selector/quantity-selector.component";
import { CharInitialsPipe } from "../../shared/char-initials.pipe";

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxImageZoomModule, MdbTabsModule, MdbTooltipModule, FontAwesomeModule, StarRatingComponent, RatingSummaryComponent, QuantitySelectorComponent, CharInitialsPipe],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss'
})
export default class DetailsComponent implements OnInit {
  productId!: number;
  product!: ProductModel;
  categories: ProductCategory[] = [];
  categoryMap: { [id: number]: string } = {};
  categoryName = '';
  selectedImageUrl!: string;
  selectedImageType!: string;
  selectedOptions: { [key: string]: string } = {};
  selectedVariant: ProductVariant | null = null;
  groupedOptions: { [key: string]: string[] } = {};
  selectedQuantity: number = 1;

  userLoggedIn: boolean = false;
  newReviewText: string = '';
  newReviewRating: number = 0;
  editingReviewId: number | null = null;
  editableText: string = '';
  editableRating: number = 0;

  apiUrl = environment.apiBaseUrl;
  productImages: ProductImageModel[] = [];
  productImageUrl = environment.apiEndpoints.product_images.getImage;

  faFacebookF = faFacebookF;
  faInstagram = faInstagram;
  faXTwitter = faXTwitter;
  faPinterestP = faPinterestP;
  faLinkedinIn = faLinkedinIn;
  faCodeCompare = faCodeCompare;
  faEnvelope = faEnvelope;
  faHeart = faHeart;
  faPrint = faPrint;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private categoryService: CategoryService,
    private cartService: CartService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    const paramId = this.route.snapshot.paramMap.get('productId') ?? '0';
    this.productId = +paramId;

    this.route.paramMap.subscribe((params) => {
      const id = params.get('productId') ?? '0';
      this.productId = +id;
      this.getProduct();
      this.getCategoryName();
    });

    this.userLoggedIn = this.authService.isLoggedIn();
  }

  getProduct(): void {
    this.productService.getProduct(this.productId).subscribe({
      next: (data: ProductModel) => {
        this.product = data;
        console.log('Product', this.product);
  
        console.log('Product category ID:', this.product.category_id);
        this.categoryName = this.categoryMap[this.product.category_id] || 'Unknown';
        console.log('Assigned category name:', this.categoryName);

        // Show default variant (first one) by default
        if (this.product?.variants && this.product.variants.length > 0) {
          this.selectedVariant = this.product.variants[0];
        }
  
        // Group options for the UI
        if (this.product?.options) {
          this.groupProductOptions(this.product.options);
        }
  
        // Flatten variant images
        this.productImages = data.variants?.flatMap(variant => variant.product_images) || [];
  
        // Show first image
        if (this.productImages.length > 0) {
          this.selectedImageUrl = this.productImages[0].image_url;
          this.selectedImageType = this.getMediaType(this.selectedImageUrl);
        }
  
        // Reset selected options
        this.selectedOptions = {};

        // ✅ Set category name if map is ready
        this.getCategoryName();
      },
      error: (error) => {
        console.error('Error fetching product details', error);
      }
    });
  }

  get avgRating(): number {
    return this.productService.getAverageRating(this.product.reviews);
  }

  enableReviewEdit(review: ProductReview) {
    this.editingReviewId = review.id;
    this.editableText = review.review_text;
    this.editableRating = review.rating;
  }

  cancelReviewEdit() {
    this.editingReviewId = null;
    this.editableText = '';
    this.editableRating = 0;
  }

  submitReview() {
    if (!this.newReviewText.trim() || this.newReviewRating === 0) return;

    const currentUser = this.authService.getCurrentUserSync();
    if (!currentUser) return;

    const reviewPayload = {
      rating: this.newReviewRating,
      review_text: this.newReviewText,
      product_id: this.product.id,
      user_id: currentUser.id
    };

    this.productService.submitReview(reviewPayload).subscribe({
      next: (savedReview: ProductReview) => { // Assuming your API returns the saved review

        if (!this.product.reviews) {
          this.product.reviews = [];
        }

        this.product.reviews.push(savedReview); // ✅ Full typed ProductReview including ID

        // this.avgRating = this.productService.getAverageRating(this.product.reviews);

        // Reset form
        this.newReviewText = '';
        this.newReviewRating = 0;
      },
      error: (err) => console.error('Error submitting review', err)
    });
  }

  updateReview(reviewId: number) {
    const updatedReview = {
      rating: this.editableRating,
      review_text: this.editableText
    };

    this.productService.updateReview(reviewId, updatedReview).subscribe({
      next: () => {
        const review = this.product.reviews?.find(r => r.id === reviewId);
        if (review) {
          review.rating = this.editableRating;
          review.review_text = this.editableText;
        }
        this.editingReviewId = null;
        this.avgRating; // Will auto-refresh if using a getter
      },
      error: (err) => console.error('Error updating review', err)
    });
  }

  deleteReview(reviewId: number) {
    this.productService.deleteReview(reviewId).subscribe({
      next: () => {
        this.product.reviews = this.product.reviews?.filter(r => r.id !== reviewId);
      },
      error: (err) => console.error('Error deleting review', err)
    });
  }

  getCategoryName() {
    this.categoryService.getAllCategories().subscribe(categories => {
      return this.categoryName = this.categoryService.getCategoryNameById(this.product.category_id, categories);
    });
  }

  mediaClicked(mediaUrl: string): void {
    this.selectedImageUrl = mediaUrl;
    this.selectedImageType = this.getMediaType(mediaUrl);
  }

  getMediaType(url: string): string {
    const ext = url.split('.').pop()?.toLowerCase();
    return ext === 'mp4' || ext === 'webm' ? 'video' : 'image';
  }

  isVideo(): boolean {
    return this.selectedImageType === 'video';
  }

  private groupProductOptions(options: any[]): void {
    const optionGroups: { [key: string]: string[] } = {};
  
    options.forEach(option => {
      const values: ProductOptionValue[] = option.option_values || [];
  
      values.forEach((ov: ProductOptionValue) => {
        const key = ov.option_name;
        const value = ov.option_value;
  
        if (!optionGroups[key]) {
          optionGroups[key] = [];
        }
  
        if (!optionGroups[key].includes(value)) {
          optionGroups[key].push(value);
        }
      });
    });
  
    this.groupedOptions = optionGroups;
    // console.log('Grouped Options:', this.groupedOptions);
  }  

  onOptionSelect(optionName: string, value: string) {
    this.selectedOptions[optionName] = value;
    console.log('Selected Options:', this.selectedOptions);
    this.updateSelectedVariant();
    console.log('Selected Variant:', this.selectedVariant);
  }

  updateSelectedVariant(): void {
    if (!this.product?.variants) return;
  
    // Try to find a variant that matches at least one selected option
    this.selectedVariant = this.product.variants.find(variant => {
      return Object.entries(this.selectedOptions).some(([name, value]) =>
        variant.optionValues?.[name] === value
      );
    }) ?? null;
  
    console.log('Selected Options:', this.selectedOptions);
    console.log('Selected Variant:', this.selectedVariant);
  }      

  getOptionNames(): string[] {
    return Object.keys(this.groupedOptions || {});
  }

  addToCart() {
    if (this.selectedQuantity <= 0) return;

    this.cartService.addToCart(this.product, this.selectedVariant!, this.selectedQuantity);
  }

  get displayPrice(): number {
    const price = this.selectedVariant?.discountPrice ?? this.selectedVariant?.price ?? 0;
    return price * this.selectedQuantity;
  }

  isInStock(): boolean {
    return this.productService.isInStock(this.product, this.selectedVariant);
  }

  trackByFn(index: number, item: any): number {
    return item.id; // or index if you don't have unique IDs
  }
}