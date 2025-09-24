import { Injectable } from '@angular/core';
import { ProductModel, ProductVariant } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class PricingService {

  constructor() {}

  /**
   * Check if a variant has a valid discount
   * Returns true if discountPrice exists, is not null, is not 0, and is less than the original price
   */
  hasValidDiscount(variant: ProductVariant | null | undefined): boolean {
    if (!variant) return false;
    
    const { price, discountPrice } = variant;
    return discountPrice != null && 
           discountPrice > 0 && 
           discountPrice < price;
  }

  /**
   * Get the effective price for display (discounted price if valid, otherwise original price)
   */
  getEffectivePrice(variant: ProductVariant | null | undefined): number {
    if (!variant) return 0;
    
    return this.hasValidDiscount(variant) ? variant.discountPrice! : variant.price;
  }

  /**
   * Get the display price - returns discountPrice only if it's a valid discount, otherwise null
   */
  getDiscountPrice(variant: ProductVariant | null | undefined): number | null {
    if (!variant || !this.hasValidDiscount(variant)) return null;
    
    return variant.discountPrice!;
  }

  /**
   * Get the original price
   */
  getOriginalPrice(variant: ProductVariant | null | undefined): number {
    return variant?.price || 0;
  }

  /**
   * Get discount percentage
   */
  getDiscountPercentage(variant: ProductVariant | null | undefined): number {
    if (!variant || !this.hasValidDiscount(variant)) return 0;
    
    const { price, discountPrice } = variant;
    return Math.round(((price - discountPrice!) / price) * 100);
  }

  /**
   * Check if a product has any variant with a valid discount
   */
  productHasDiscount(product: ProductModel): boolean {
    return product.variants?.some(variant => this.hasValidDiscount(variant)) ?? false;
  }

  /**
   * Get the best price among all variants (lowest effective price)
   */
  getBestPrice(product: ProductModel): number {
    if (!product.variants?.length) return 0;
    
    const prices = product.variants.map(variant => this.getEffectivePrice(variant));
    return Math.min(...prices);
  }

  /**
   * Get pricing info for a variant - all pricing data in one object
   */
  getVariantPricingInfo(variant: ProductVariant | null | undefined) {
    return {
      hasDiscount: this.hasValidDiscount(variant),
      originalPrice: this.getOriginalPrice(variant),
      discountPrice: this.getDiscountPrice(variant),
      effectivePrice: this.getEffectivePrice(variant),
      discountPercentage: this.getDiscountPercentage(variant),
      savings: variant && this.hasValidDiscount(variant) 
        ? variant.price - variant.discountPrice! 
        : 0
    };
  }

  /**
   * Get pricing info for a product (uses first variant or best price)
   */
  getProductPricingInfo(product: ProductModel, useFirstVariant: boolean = true) {
    const variant = useFirstVariant 
      ? product.variants?.[0] 
      : product.variants?.reduce((best, current) => 
          this.getEffectivePrice(current) < this.getEffectivePrice(best) ? current : best
        );

    return {
      ...this.getVariantPricingInfo(variant),
      productHasDiscount: this.productHasDiscount(product),
      bestPrice: this.getBestPrice(product),
      variantCount: product.variants?.length || 0
    };
  }

  /**
   * Format price for display with currency symbol
   */
  formatPrice(price: number, currency: string = '$'): string {
    return `${currency}${price.toFixed(2)}`;
  }

  /**
   * Get price range for products with multiple variants
   */
  getPriceRange(product: ProductModel): { min: number; max: number; hasRange: boolean } {
    if (!product.variants?.length) {
      return { min: 0, max: 0, hasRange: false };
    }

    const effectivePrices = product.variants.map(variant => this.getEffectivePrice(variant));
    const min = Math.min(...effectivePrices);
    const max = Math.max(...effectivePrices);

    return { 
      min, 
      max, 
      hasRange: min !== max 
    };
  }

  /**
   * Get formatted price range string
   */
  getFormattedPriceRange(product: ProductModel, currency: string = '$'): string {
    const range = this.getPriceRange(product);
    
    if (!range.hasRange) {
      return this.formatPrice(range.min, currency);
    }
    
    return `${this.formatPrice(range.min, currency)} - ${this.formatPrice(range.max, currency)}`;
  }

  /**
   * Filter products that have valid discounts
   */
  filterDiscountedProducts(products: ProductModel[]): ProductModel[] {
    return products.filter(product => this.productHasDiscount(product));
  }

  /**
   * Sort products by discount percentage (highest first)
   */
  sortByDiscountPercentage(products: ProductModel[]): ProductModel[] {
    return [...products].sort((a, b) => {
      const aDiscount = this.getProductPricingInfo(a).discountPercentage;
      const bDiscount = this.getProductPricingInfo(b).discountPercentage;
      return bDiscount - aDiscount;
    });
  }

  /**
   * Sort products by effective price (lowest first)
   */
  sortByPrice(products: ProductModel[], ascending: boolean = true): ProductModel[] {
    return [...products].sort((a, b) => {
      const aPrice = this.getProductPricingInfo(a).effectivePrice;
      const bPrice = this.getProductPricingInfo(b).effectivePrice;
      return ascending ? aPrice - bPrice : bPrice - aPrice;
    });
  }

  /**
   * Filter products by price range (using effective prices)
   */
  filterByPriceRange(products: ProductModel[], minPrice: number, maxPrice: number): ProductModel[] {
    return products.filter(product => {
      const effectivePrice = this.getProductPricingInfo(product).effectivePrice;
      return effectivePrice >= minPrice && effectivePrice <= maxPrice;
    });
  }

  /**
   * Calculate total savings for a product
   */
  getTotalSavings(product: ProductModel, quantity: number = 1): number {
    const pricingInfo = this.getProductPricingInfo(product);
    return pricingInfo.savings * quantity;
  }

  /**
   * Check if a price is on sale (has discount)
   */
  isOnSale(variant: ProductVariant | null | undefined): boolean {
    return this.hasValidDiscount(variant);
  }

  /**
   * Get sale badge text
   */
  getSaleBadgeText(variant: ProductVariant | null | undefined): string | null {
    const percentage = this.getDiscountPercentage(variant);
    return percentage > 0 ? `-${percentage}%` : null;
  }

  /**
   * Calculate cart total with proper pricing
   */
  calculateCartTotal(items: Array<{ product: ProductModel; variant: ProductVariant; quantity: number }>): {
    subtotal: number;
    totalSavings: number;
    originalTotal: number;
  } {
    let subtotal = 0;
    let originalTotal = 0;

    items.forEach(item => {
      const effectivePrice = this.getEffectivePrice(item.variant);
      const originalPrice = this.getOriginalPrice(item.variant);
      
      subtotal += effectivePrice * item.quantity;
      originalTotal += originalPrice * item.quantity;
    });

    return {
      subtotal,
      totalSavings: originalTotal - subtotal,
      originalTotal
    };
  }
}