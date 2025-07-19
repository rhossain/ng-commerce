import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ProductModel, ProductVariant } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { CartIntegrationService } from '../../services/cart-integration.service';
import { SwiperOptions } from 'swiper/types';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCartPlus, faHeart } from '@fortawesome/free-solid-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { ProductUtils } from '../../utils/product-utils';

@Component({
  selector: 'app-product-slider',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  templateUrl: './product-slider.component.html',
  styleUrl: './product-slider.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProductSliderComponent implements OnInit {
  @Input() productIds: number[] = [];
  @Input() showAddToCartButton: boolean = true;
  @Input() showPricing: boolean = true;
  @Input() showRating: boolean = false;
  
  products: { product: ProductModel; variant: ProductVariant | null }[] = [];
  loadingImages: boolean[] = [];
  addingToCart: { [key: string]: boolean } = {}; // Track loading state per product-variant

  // FontAwesome icons
  faCartPlus = faCartPlus;
  faHeart = faHeart;

  sliderConfig: SwiperOptions = {
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    autoplay: { delay: 3000 },
    allowTouchMove: true,
    pagination: {
      el: '.swiper-pagination',
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    scrollbar: {
      el: '.swiper-scrollbar',
    },
    breakpoints: {
      640: {
        slidesPerView: 2,
        spaceBetween: 20,
      },
      768: {
        slidesPerView: 3,
        spaceBetween: 30,
      },
      1024: {
        slidesPerView: 4,
        spaceBetween: 40,
      },
    },
  };

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private cartIntegrationService: CartIntegrationService,
    private toastr: ToastrService
  ) {}
  
  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    if (!this.productIds?.length) return;
    
    const requests = this.productIds.map(id => this.productService.getProduct(id));
    forkJoin(requests).subscribe({
      next: (products) => {
        this.products = products.map(p => {
          const firstVariant = p.variants?.[0] || null;
          return { product: p, variant: firstVariant };
        });

        // Initialize all loading states to true
        this.loadingImages = Array(this.products.length).fill(true);
      },
      error: (error) => {
        console.error('Error loading products for slider:', error);
        this.toastr.error('Failed to load products', 'Error');
      }
    });
  }

  /**
   * Add product to cart with proper loading states and error handling
   */
  async addToCart(product: ProductModel, variant: ProductVariant | null, quantity: number = 1): Promise<void> {
    // Create unique key for this product-variant combination
    const cartKey = `${product.id}-${variant?.id || 0}`;
    
    // Use the cart integration service to handle the add to cart with loading states
    const success = await this.cartIntegrationService.handleCartAction(
      () => this.cartIntegrationService.addToCart(product, variant, { quantity }),
      cartKey,
      this.addingToCart
    );

    if (success) {
      // Optional: Add some visual feedback
      this.showAddToCartSuccess(product.name);
    }
  }

  /**
   * Quick add to cart with default quantity
   */
  async quickAddToCart(product: ProductModel, variant: ProductVariant | null): Promise<void> {
    await this.addToCart(product, variant, 1);
  }

  /**
   * Check if item is currently being added to cart
   */
  isAddingToCart(product: ProductModel, variant: ProductVariant | null): boolean {
    if (!variant) return false;
    const cartKey = `${product.id}-${variant.id}`;
    return !!this.addingToCart[cartKey];
  }

  /**
   * Check if product variant is in stock
   */
  isInStock(variant: ProductVariant | null): boolean {
    return ProductUtils.isInStock(variant);
  }

  /**
   * Get display price (discount price if available, otherwise regular price)
   */
  getDisplayPrice(variant: ProductVariant | null): number {
    return ProductUtils.getEffectivePrice(variant);
  }

  /**
   * Get original price (for showing crossed out price)
   */
  getOriginalPrice(variant: ProductVariant | null): number {
    if (!variant) return 0;
    return variant.price;
  }

  /**
   * Check if product has discount
   */
  hasDiscount(variant: ProductVariant | null): boolean {
    return ProductUtils.hasValidDiscount(variant);
  }

  /**
   * Get discount percentage
   */
  getDiscountPercentage(variant: ProductVariant | null): number {
    return ProductUtils.getDiscountPercentage(variant);
  }

  /**
   * Check if item is already in cart
   */
  isInCart(product: ProductModel, variant: ProductVariant | null): boolean {
    if (!variant) return false;
    return this.cartService.isInCart(product.id, variant.id);
  }

  /**
   * Get quantity of item in cart
   */
  getCartQuantity(product: ProductModel, variant: ProductVariant | null): number {
    if (!variant) return 0;
    return this.cartService.getItemQuantity(product.id, variant.id);
  }

  /**
   * Handle image load events
   */
  onImageLoad(index: number): void {
    if (index < this.loadingImages.length) {
      this.loadingImages[index] = false;
    }
  }

  /**
   * Handle image error events
   */
  onImageError(index: number): void {
    if (index < this.loadingImages.length) {
      this.loadingImages[index] = false;
    }
  }

  /**
   * Show success message with product name
   */
  private showAddToCartSuccess(productName: string): void {
    // The CartService already shows a toast, but we can add additional feedback here
    // For example, we could emit an event or trigger an animation
  }

  /**
   * Get product image URL with fallback
   */
  getProductImageUrl(product: ProductModel, variant: ProductVariant | null): string {
    return ProductUtils.getProductImageUrl(product, variant);
  }

  /**
   * Handle wishlist functionality (if needed)
   */
  addToWishlist(product: ProductModel): void {
    // Implement wishlist functionality if you have a wishlist service
    this.toastr.info('Wishlist functionality not implemented yet', 'Info');
  }

  /**
   * Track by function for ngFor performance
   */
  trackByProductId(index: number, item: { product: ProductModel; variant: ProductVariant | null }): number {
    return item.product.id;
  }

  /**
   * Get stock status text
   */
  getStockStatusText(variant: ProductVariant | null): string {
    return ProductUtils.getStockStatusText(variant);
  }

  /**
   * Get stock status CSS class
   */
  getStockStatusClass(variant: ProductVariant | null): string {
    return ProductUtils.getStockStatusClass(variant);
  }

  /**
   * Check if variant is low stock
   */
  isLowStock(variant: ProductVariant | null): boolean {
    return ProductUtils.isLowStock(variant);
  }

  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    return ProductUtils.formatPrice(price);
  }

  /**
   * Get cart status for display
   */
  getCartStatus(product: ProductModel, variant: ProductVariant | null): {
    inCart: boolean;
    quantity: number;
    canAddMore: boolean;
    maxAddable: number;
    isLowStock: boolean;
  } {
    return this.cartIntegrationService.getCartStatus(product, variant);
  }

  /**
   * Check if more items can be added to cart
   */
  canAddMore(product: ProductModel, variant: ProductVariant | null): boolean {
    return this.cartIntegrationService.canAddMore(product, variant);
  }

  /**
   * Get maximum addable quantity
   */
  getMaxAddableQuantity(product: ProductModel, variant: ProductVariant | null): number {
    return this.cartIntegrationService.getMaxAddableQuantity(product, variant);
  }

  /**
   * Handle add to cart button click with validation
   */
  async onAddToCartClick(product: ProductModel, variant: ProductVariant | null): Promise<void> {
    // Validate before adding
    const validation = this.cartIntegrationService.validateAddToCart(product, variant, {
      quantity: 1,
      validateStock: true,
      allowOutOfStock: false
    });

    if (!validation.canAdd) {
      this.toastr.warning(validation.reason || 'Cannot add item to cart', 'Cart Error');
      return;
    }

    await this.quickAddToCart(product, variant);
  }

  /**
   * Get add to cart button text
   */
  getAddToCartButtonText(product: ProductModel, variant: ProductVariant | null): string {
    if (!variant) return 'Unavailable';
    
    const cartStatus = this.getCartStatus(product, variant);
    
    if (!this.isInStock(variant)) {
      return 'Out of Stock';
    }
    
    if (cartStatus.inCart) {
      return cartStatus.canAddMore ? 'Add More' : 'In Cart';
    }
    
    return 'Add to Cart';
  }

  /**
   * Check if add to cart button should be disabled
   */
  isAddToCartDisabled(product: ProductModel, variant: ProductVariant | null): boolean {
    if (!variant) return true;
    
    const cartStatus = this.getCartStatus(product, variant);
    
    return !this.isInStock(variant) || 
           this.isAddingToCart(product, variant) ||
           (!cartStatus.canAddMore && cartStatus.inCart);
  }

  /**
   * Get product badge text
   */
  getProductBadges(product: ProductModel, variant: ProductVariant | null): Array<{
    text: string;
    class: string;
    show: boolean;
  }> {
    return [
      {
        text: `-${this.getDiscountPercentage(variant)}%`,
        class: 'badge-discount',
        show: this.hasDiscount(variant)
      },
      {
        text: 'New',
        class: 'badge-new',
        show: product.isNewArrival
      },
      {
        text: 'Featured',
        class: 'badge-featured',
        show: product.isFeatured
      },
      {
        text: 'Out of Stock',
        class: 'badge-out-of-stock',
        show: !this.isInStock(variant)
      },
      {
        text: 'Low Stock',
        class: 'badge-low-stock',
        show: this.isLowStock(variant)
      }
    ];
  }

  /**
   * Refresh products data
   */
  refreshProducts(): void {
    this.loadProducts();
  }

  /**
   * Handle slider initialization
   */
  onSliderInit(): void {
    // Handle any slider initialization logic
    console.log('Product slider initialized');
  }

  /**
   * Handle slider slide change
   */
  onSlideChange(): void {
    // Handle slide change events if needed
  }

  /**
   * Check if slider should be shown
   */
  shouldShowSlider(): boolean {
    return this.products.length > 0;
  }

  /**
   * Check if loading state should be shown
   */
  shouldShowLoading(): boolean {
    return this.productIds.length > 0 && this.products.length === 0;
  }

  /**
   * Check if empty state should be shown
   */
  shouldShowEmpty(): boolean {
    return this.productIds.length === 0 || (this.productIds.length > 0 && this.products.length === 0);
  }
}