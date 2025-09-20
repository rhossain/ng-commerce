// product-quickview.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faTimes, 
  faCartPlus, 
  faCheck,
  faHeart,
  faEye
} from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';

import { ProductModel, ProductVariant } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { PricingService } from '../../services/pricing.service';
import { ProductService } from '../../services/product.service';
import { StarRatingComponent } from '../../shared/star-rating/star-rating.component';
import { WishlistButtonComponent } from '../../components/wishlist/wishlist-button/wishlist-button.component';
import { QuantitySelectorComponent } from '../../shared/quantity-selector/quantity-selector.component';

@Component({
  selector: 'app-quickview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FontAwesomeModule,
    StarRatingComponent,
    WishlistButtonComponent,
    QuantitySelectorComponent
  ],
  templateUrl: './quickview.component.html',
  styleUrl: './quickview.component.scss'
})
export class QuickviewComponent implements OnInit {
  @Input() product!: ProductModel;
  
  quantity = 1;
  isAddingToCart = false;
  imageLoading = true;
  fallbackImageUrl = 'assets/images/image-not-loaded.jpg';

  // Icons
  faTimes = faTimes;
  faCartPlus = faCartPlus;
  faCheck = faCheck;
  faHeart = faHeart;
  faEye = faEye;

  constructor(
    private activeModal: NgbActiveModal,
    private cartService: CartService,
    private pricingService: PricingService,
    private productService: ProductService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // Pre-load the main image
    this.preloadMainImage();
  }

  private preloadMainImage(): void {
    const imageUrl = this.getMainImage();
    if (imageUrl && imageUrl !== this.fallbackImageUrl) {
      const img = new Image();
      img.onload = () => {
        this.imageLoading = false;
      };
      img.onerror = () => {
        this.imageLoading = false;
      };
      img.src = imageUrl;
    } else {
      this.imageLoading = false;
    }
  }

  closeModal(): void {
    this.activeModal.close();
  }

  // Image Methods
  getMainImage(): string {
    const mainImage = this.product?.main_image_url ||
                     this.product?.variants?.[0]?.product_images?.[0]?.image_url;
    return mainImage || this.fallbackImageUrl;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = this.fallbackImageUrl;
    this.imageLoading = false;
  }

  // Pricing Methods
  hasDiscount(): boolean {
    const variant = this.getFirstVariant();
    return this.pricingService.hasValidDiscount(variant);
  }

  getDiscountPrice(): number | null {
    const variant = this.getFirstVariant();
    return this.pricingService.getDiscountPrice(variant);
  }

  getOriginalPrice(): number {
    const variant = this.getFirstVariant();
    return this.pricingService.getOriginalPrice(variant);
  }

  getEffectivePrice(): number {
    const variant = this.getFirstVariant();
    return this.pricingService.getEffectivePrice(variant);
  }

  getSavings(): number {
    const variant = this.getFirstVariant();
    const pricingInfo = this.pricingService.getVariantPricingInfo(variant);
    return pricingInfo.savings;
  }

  getSaleBadge(): string {
    const variant = this.getFirstVariant();
    return this.pricingService.getSaleBadgeText(variant) || '';
  }

  // Stock Methods
  isInStock(): boolean {
    const variant = this.getFirstVariant();
    return variant ? variant.stock > 0 : false;
  }

  getStockQuantity(): number {
    const variant = this.getFirstVariant();
    return variant ? variant.stock : 0;
  }

  getMaxQuantity(): number {
    const stockQuantity = this.getStockQuantity();
    const currentInCart = this.cartService.getItemQuantity(this.product.id, this.getFirstVariant()?.id || 0);
    return Math.max(0, stockQuantity - currentInCart);
  }

  // Quantity Methods - Updated to work with quantity selector component
  onQuantityChange(newQuantity: number): void {
    this.quantity = newQuantity;
  }

  onStockOut(): void {
    this.toastr.warning('Maximum available quantity selected', 'Stock Limit');
  }

  // Cart Methods
  async addToCart(): Promise<void> {
    if (this.isAddingToCart || !this.isInStock()) return;
    
    this.isAddingToCart = true;
    
    try {
      const variant = this.getFirstVariant();
      
      if (!variant) {
        this.toastr.warning('No variant available for this product', 'Cannot Add to Cart');
        return;
      }

      // Validate quantity
      if (this.quantity > this.getMaxQuantity()) {
        this.toastr.warning(
          `Only ${this.getMaxQuantity()} more items can be added to cart`, 
          'Quantity Limited'
        );
        this.quantity = this.getMaxQuantity();
        return;
      }

      this.cartService.addToCart(this.product, variant, this.quantity);
      
      // Optionally close modal after adding to cart
      // this.closeModal();
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.toastr.error('Failed to add item to cart', 'Error');
    } finally {
      this.isAddingToCart = false;
    }
  }

  // Rating Methods
  get avgRating(): number {
    return this.productService.getAverageRating(this.product.reviews);
  }

  // Product Info Methods
  getFirstVariant(): ProductVariant | null {
    return this.product?.variants?.[0] || null;
  }

  hasVariants(): boolean {
    return (this.product?.variants?.length || 0) > 0;
  }

  getVariantCount(): number {
    return this.product?.variants?.length || 0;
  }

  getTotalSold(): number {
    return this.product?.variants?.reduce((total, variant) => {
      return total + (variant.totalSold || 0);
    }, 0) || 0;
  }

  getCategoryName(): string {
    // If category is populated, return its name
    // Otherwise return category_id as fallback
    return (this.product as any)?.category?.name || `Category ${this.product?.category_id}`;
  }

  // Utility Methods
  formatPrice(price: number): string {
    return this.pricingService.formatPrice(price);
  }

  // Keyboard support
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeModal();
    }
  }
}