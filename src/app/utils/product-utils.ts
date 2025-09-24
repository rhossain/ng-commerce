// product-utils.ts - Type guards and utilities for products
import { ProductModel, ProductVariant } from '../models/product.model';

export class ProductUtils {
  /**
   * Type guard to check if a variant has a discount price
   */
  static hasDiscountPrice(variant: ProductVariant | null): variant is ProductVariant & { discountPrice: number } {
    return variant !== null && 
           variant.discountPrice !== null && 
           variant.discountPrice !== undefined &&
           variant.discountPrice >= 0;
  }

  /**
   * Type guard to check if a variant has a valid discount (discount price < regular price)
   */
  static hasValidDiscount(variant: ProductVariant | null): variant is ProductVariant & { discountPrice: number } {
    return this.hasDiscountPrice(variant) && variant.discountPrice < variant.price;
  }

  /**
   * Get effective price with type safety
   */
  static getEffectivePrice(variant: ProductVariant | null): number {
    if (!variant) return 0;
    return this.hasDiscountPrice(variant) ? variant.discountPrice : variant.price;
  }

  /**
   * Get discount percentage with type safety
   */
  static getDiscountPercentage(variant: ProductVariant | null): number {
    if (!this.hasValidDiscount(variant)) return 0;
    const discount = variant.price - variant.discountPrice;
    return Math.round((discount / variant.price) * 100);
  }

  /**
   * Get discount amount with type safety
   */
  static getDiscountAmount(variant: ProductVariant | null): number {
    if (!this.hasValidDiscount(variant)) return 0;
    return variant.price - variant.discountPrice;
  }

  /**
   * Check if product is in stock
   */
  static isInStock(variant: ProductVariant | null): boolean {
    return variant !== null && variant.stock > 0;
  }

  /**
   * Check if product is low stock (customizable threshold)
   */
  static isLowStock(variant: ProductVariant | null, threshold: number = 5): boolean {
    return variant !== null && variant.stock > 0 && variant.stock <= threshold;
  }

  /**
   * Get stock status text
   */
  static getStockStatusText(variant: ProductVariant | null): string {
    if (!variant) return 'Unavailable';
    if (variant.stock === 0) return 'Out of Stock';
    if (variant.stock <= 5) return `Low Stock (${variant.stock} left)`;
    return 'In Stock';
  }

  /**
   * Get stock status class for styling
   */
  static getStockStatusClass(variant: ProductVariant | null): string {
    if (!variant || variant.stock === 0) return 'out-of-stock';
    if (variant.stock <= 5) return 'low-stock';
    return 'in-stock';
  }

  /**
   * Validate product data
   */
  static validateProduct(product: ProductModel): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!product.id || product.id <= 0) {
      issues.push('Invalid product ID');
    }

    if (!product.name || product.name.trim().length === 0) {
      issues.push('Product name is required');
    }

    if (!product.variants || product.variants.length === 0) {
      issues.push('Product must have at least one variant');
    } else {
      product.variants.forEach((variant, index) => {
        const variantValidation = this.validateVariant(variant);
        if (!variantValidation.valid) {
          issues.push(`Variant ${index + 1}: ${variantValidation.issues.join(', ')}`);
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate variant data
   */
  static validateVariant(variant: ProductVariant): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!variant.id || variant.id <= 0) {
      issues.push('Invalid variant ID');
    }

    if (!variant.price || variant.price <= 0) {
      issues.push('Variant price must be greater than 0');
    }

    if (variant.discountPrice !== null && variant.discountPrice !== undefined) {
      if (variant.discountPrice < 0) {
        issues.push('Discount price cannot be negative');
      }
      if (variant.discountPrice >= variant.price) {
        issues.push('Discount price must be less than regular price');
      }
    }

    if (variant.stock < 0) {
      issues.push('Stock cannot be negative');
    }

    if (!variant.sku || variant.sku.trim().length === 0) {
      issues.push('SKU is required');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Format price for display
   */
  static formatPrice(price: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
  }

  /**
   * Get product main image URL with fallback
   */
  static getProductImageUrl(product: ProductModel, variant?: ProductVariant | null): string {
    // Try variant images first
    if (variant?.product_images?.length) {
      return variant.product_images[0].image_url;
    }
    
    // Fall back to product main image
    if (product.main_image_url) {
      return product.main_image_url;
    }
    
    // Final fallback
    return 'assets/images/placeholder-product.jpg';
  }

  /**
   * Get all product images
   */
  static getAllProductImages(product: ProductModel): string[] {
    const images: string[] = [];
    
    // Add main image if available
    if (product.main_image_url) {
      images.push(product.main_image_url);
    }
    
    // Add variant images
    if (product.variants) {
      product.variants.forEach(variant => {
        if (variant.product_images) {
          variant.product_images.forEach(img => {
            if (!images.includes(img.image_url)) {
              images.push(img.image_url);
            }
          });
        }
      });
    }
    
    return images;
  }

  /**
   * Calculate savings for a variant
   */
  static calculateSavings(variant: ProductVariant | null, quantity: number = 1): number {
    if (!this.hasValidDiscount(variant)) return 0;
    return (variant.price - variant.discountPrice) * quantity;
  }

  /**
   * Get variant by option values
   */
  static getVariantByOptions(
    product: ProductModel, 
    selectedOptions: { [key: string]: string }
  ): ProductVariant | null {
    if (!product.variants || product.variants.length === 0) return null;
    
    return product.variants.find(variant => {
      if (!variant.optionValues) return false;
      
      return Object.entries(selectedOptions).every(([optionName, optionValue]) => {
        return variant.optionValues![optionName] === optionValue;
      });
    }) || null;
  }

  /**
   * Get available option values for a product
   */
  static getAvailableOptionValues(product: ProductModel): { [key: string]: string[] } {
    const optionValues: { [key: string]: string[] } = {};
    
    if (!product.variants) return optionValues;
    
    product.variants.forEach(variant => {
      if (variant.optionValues) {
        Object.entries(variant.optionValues).forEach(([optionName, optionValue]) => {
          if (!optionValues[optionName]) {
            optionValues[optionName] = [];
          }
          if (!optionValues[optionName].includes(optionValue)) {
            optionValues[optionName].push(optionValue);
          }
        });
      }
    });
    
    return optionValues;
  }

  /**
   * Filter products by price range
   */
  static filterByPriceRange(
    products: ProductModel[], 
    minPrice: number, 
    maxPrice: number
  ): ProductModel[] {
    return products.filter(product => {
      if (!product.variants || product.variants.length === 0) return false;
      
      return product.variants.some(variant => {
        const effectivePrice = this.getEffectivePrice(variant);
        return effectivePrice >= minPrice && effectivePrice <= maxPrice;
      });
    });
  }

  /**
   * Sort products by price
   */
  static sortByPrice(products: ProductModel[], ascending: boolean = true): ProductModel[] {
    return products.sort((a, b) => {
      const aPrice = this.getLowestPrice(a);
      const bPrice = this.getLowestPrice(b);
      
      return ascending ? aPrice - bPrice : bPrice - aPrice;
    });
  }

  /**
   * Get lowest price from all variants
   */
  static getLowestPrice(product: ProductModel): number {
    if (!product.variants || product.variants.length === 0) return 0;
    
    return Math.min(...product.variants.map(variant => this.getEffectivePrice(variant)));
  }

  /**
   * Get highest price from all variants
   */
  static getHighestPrice(product: ProductModel): number {
    if (!product.variants || product.variants.length === 0) return 0;
    
    return Math.max(...product.variants.map(variant => this.getEffectivePrice(variant)));
  }

  /**
   * Get price range for a product
   */
  static getPriceRange(product: ProductModel): { min: number; max: number } {
    return {
      min: this.getLowestPrice(product),
      max: this.getHighestPrice(product)
    };
  }
}