import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgxImageZoomModule } from 'ngx-image-zoom';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCodeCompare, faHeart } from '@fortawesome/free-solid-svg-icons';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { environment } from '../../../environments/environment';
import { ProductImageModel, ProductModel, ProductOptionValue, ProductVariant, ProductReview } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { ProductSocialsComponent } from "./product-socials/product-socials.component";
import { BreadcrumbComponent } from "./breadcrumb/breadcrumb.component";
import { ProductInfoComponent } from "./product-info/product-info.component";
import { ProductDescriptionComponent } from "./product-description/product-description.component";
import { ProductReviewsComponent } from "./product-reviews/product-reviews.component";
import { ProductGalleryComponent } from "./product-gallery/product-gallery.component";

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxImageZoomModule, FontAwesomeModule, NgbNavModule, ProductSocialsComponent, BreadcrumbComponent, ProductInfoComponent, ProductDescriptionComponent, ProductReviewsComponent, ProductGalleryComponent],
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

  faCodeCompare = faCodeCompare;
  faHeart = faHeart;

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

  submitReview(event: { rating: number, text: string }) {
    if (!event.text.trim() || event.rating === 0) return;

    const currentUser = this.authService.getCurrentUserSync();
    if (!currentUser) return;

    const reviewPayload = {
      rating: event.rating,
      review_text: event.text,
      product_id: this.product.id,
      user_id: currentUser.id
    };

    this.productService.submitReview(reviewPayload).subscribe({
      next: (savedReview: ProductReview) => {
        if (!this.product.reviews) {
          this.product.reviews = [];
        }

        // ✅ Create a complete review object with user information
        const completeReview: ProductReview = {
          ...savedReview,
          user: {
            id: currentUser.id,
            name: `${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.name,
            email: currentUser.email,
            created_at: currentUser.created_at,
            first_name: currentUser.first_name,
            last_name: currentUser.last_name,
            street: currentUser.street,
            city: currentUser.city,
            state: currentUser.state,
            zip_code: currentUser.zip_code
          }
        };

        // Add the complete review to the list
        this.product.reviews.push(completeReview);
        
        console.log('Review added with user info:', completeReview);
      },
      error: (err) => console.error('Error submitting review', err)
    });
  }

  updateReview(reviewId: number, rating: number, text: string) {
    const updatedReview = {
      rating: rating,
      review_text: text
    };

    this.productService.updateReview(reviewId, updatedReview).subscribe({
      next: () => {
        const review = this.product.reviews?.find(r => r.id === reviewId);
        if (review) {
          review.rating = rating;
          review.review_text = text;
        }
        this.cancelReviewEdit();
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
  }  

  onOptionSelect(optionName: string, value: string) {
    this.selectedOptions[optionName] = value;
    console.log('Selected Options:', this.selectedOptions);
    this.updateSelectedVariant();
    console.log('Selected Variant:', this.selectedVariant);
  }

  updateSelectedVariant(): void {
    if (!this.product?.variants) return;
  
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
    return item.id;
  }
}