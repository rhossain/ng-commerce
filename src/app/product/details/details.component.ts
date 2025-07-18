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
      // Load categories first, then product
      this.loadCategoriesAndProduct();
    });

    this.userLoggedIn = this.authService.isLoggedIn();
  }

  private loadCategoriesAndProduct(): void {
    // First load categories to build the categoryMap
    this.categoryService.getAllCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.categoryMap = categories.reduce((map, category) => {
          map[category.id] = category.name;
          return map;
        }, {} as { [id: number]: string });
        
        // Now load the product
        this.getProduct();
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        // Continue loading product even if categories fail
        this.getProduct();
      }
    });
  }

  getProduct(): void {
    this.productService.getProduct(this.productId).subscribe({
      next: (data: ProductModel) => {
        this.product = data;
        console.log('Product loaded:', this.product);
  
        // Set category name if we have the map
        if (this.product?.category_id && this.categoryMap[this.product.category_id]) {
          this.categoryName = this.categoryMap[this.product.category_id];
        } else {
          this.categoryName = 'Unknown Category';
        }

        // Initialize variant selection
        this.initializeProductVariants();
        
        // Group options for the UI
        this.groupProductOptions();
  
        // Setup product images
        this.setupProductImages();
      },
      error: (error) => {
        console.error('Error fetching product details', error);
      }
    });
  }

  private initializeProductVariants(): void {
    if (this.product?.variants && this.product.variants.length > 0) {
      // Show default variant (first one) by default
      this.selectedVariant = this.product.variants[0];
      
      // If variant has option values, pre-select them
      if (this.selectedVariant.optionValues) {
        this.selectedOptions = { ...this.selectedVariant.optionValues };
      }
    } else {
      console.warn('No variants found for product');
      this.selectedVariant = null;
    }
  }

  private setupProductImages(): void {
    // Flatten variant images from all variants
    this.productImages = this.product.variants?.flatMap(variant => 
      variant.product_images || []
    ) || [];

    // If no variant images, try to use main product image
    if (this.productImages.length === 0 && this.product.main_image_url) {
      this.productImages = [{
        id: 0,
        created_at: Date.now(),
        image_url: this.product.main_image_url,
        product_id: this.product.id
      }];
    }

    // Set default selected image
    if (this.productImages.length > 0) {
      this.selectedImageUrl = this.productImages[0].image_url;
      this.selectedImageType = this.getMediaType(this.selectedImageUrl);
    }
  }

  private groupProductOptions(): void {
    if (!this.product?.options || this.product.options.length === 0) {
      console.log('No product options found');
      this.groupedOptions = {};
      return;
    }

    const optionGroups: { [key: string]: string[] } = {};
  
    this.product.options.forEach(option => {
      // Handle both old structure (option_values) and new structure
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
    console.log('Grouped Options:', this.groupedOptions);
  }

  get avgRating(): number {
    return this.productService.getAverageRating(this.product?.reviews);
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
        this.product.reviews.push(savedReview);
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

  mediaClicked(mediaUrl: string): void {
    this.selectedImageUrl = mediaUrl;
    this.selectedImageType = this.getMediaType(mediaUrl);
  }

  getMediaType(url: string): string {
    if (!url) return 'image';
    const ext = url.split('.').pop()?.toLowerCase();
    return ext === 'mp4' || ext === 'webm' ? 'video' : 'image';
  }

  isVideo(): boolean {
    return this.selectedImageType === 'video';
  }

  onOptionSelect(optionName: string, value: string) {
    this.selectedOptions[optionName] = value;
    console.log('Selected Options:', this.selectedOptions);
    this.updateSelectedVariant();
  }

  updateSelectedVariant(): void {
    if (!this.product?.variants || this.product.variants.length === 0) {
      this.selectedVariant = null;
      return;
    }
  
    // Try to find a variant that matches ALL selected options
    this.selectedVariant = this.product.variants.find(variant => {
      if (!variant.optionValues) return false;
      
      return Object.entries(this.selectedOptions).every(([name, value]) =>
        variant.optionValues?.[name] === value
      );
    }) || null;

    // If no exact match found and we have some options selected, 
    // try to find variant that matches at least one option
    if (!this.selectedVariant && Object.keys(this.selectedOptions).length > 0) {
      this.selectedVariant = this.product.variants.find(variant => {
        if (!variant.optionValues) return false;
        
        return Object.entries(this.selectedOptions).some(([name, value]) =>
          variant.optionValues?.[name] === value
        );
      }) || null;
    }

    // If still no match, default to first variant
    if (!this.selectedVariant) {
      this.selectedVariant = this.product.variants[0] || null;
    }
  
    console.log('Selected Variant:', this.selectedVariant);
  }

  getOptionNames(): string[] {
    return Object.keys(this.groupedOptions || {});
  }

  addToCart() {
    if (!this.selectedVariant) {
      console.error('No variant selected');
      return;
    }

    if (this.selectedQuantity <= 0) {
      console.error('Invalid quantity');
      return;
    }

    this.cartService.addToCart(this.product, this.selectedVariant, this.selectedQuantity);
  }

  get displayPrice(): number {
    if (!this.selectedVariant) return 0;
    
    const price = this.selectedVariant.discountPrice ?? this.selectedVariant.price ?? 0;
    return price * this.selectedQuantity;
  }

  isInStock(): boolean {
    if (!this.selectedVariant) return false;
    return this.productService.isInStock(this.product, this.selectedVariant);
  }

  trackByFn(index: number, item: any): number {
    return item.id || index;
  }
}