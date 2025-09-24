import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service'; // ← Add this import
import { ProductModel, ProductVariant } from '../models/product.model';
import { CartItem } from '../models/cart.model'; // ← Add this import
import { ProductUtils } from '../utils/product-utils';

export interface AddToCartOptions {
  quantity?: number;
  showSuccessMessage?: boolean;
  validateStock?: boolean;
  allowOutOfStock?: boolean;
}

export interface CartValidationResult {
  canAdd: boolean;
  reason?: string;
  maxAllowedQuantity?: number;
}

export interface ItemPricingDetails {
  hasDiscount: boolean;
  originalPrice: number;
  effectivePrice: number;
  totalPrice: number;
  savings: number;
  discountPercentage: number;
}

export interface CartTotalDetails {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  totalSavings: number;
  originalSubtotal: number;
}

export interface FreeShippingDetails {
  qualifies: boolean;
  currentTotal: number;
  amountNeeded: number;
  progress: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartIntegrationService {
  private readonly DEFAULT_OPTIONS: AddToCartOptions = {
    quantity: 1,
    showSuccessMessage: true,
    validateStock: true,
    allowOutOfStock: false
  };

  constructor(
    private cartService: CartService,
    private toastr: ToastrService,
    private pricingService: PricingService // ← Add this injection
  ) {}

  /**
   * Add product to cart with comprehensive validation and error handling
   */
  async addToCart(
    product: ProductModel,
    variant: ProductVariant | null,
    options: AddToCartOptions = {}
  ): Promise<boolean> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Validate inputs
    const validation = this.validateAddToCart(product, variant, opts);
    if (!validation.canAdd) {
      this.toastr.warning(validation.reason || 'Cannot add item to cart', 'Cart Error');
      return false;
    }

    try {
      // Add to cart
      this.cartService.addToCart(product, variant!, opts.quantity!);
      
      // Custom success message if needed
      if (opts.showSuccessMessage) {
        const message = this.getSuccessMessage(product, variant!, opts.quantity!);
        // Note: CartService already shows a toast, but we could customize it here
      }

      return true;
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.toastr.error('Failed to add item to cart', 'Error');
      return false;
    }
  }

  /**
   * Validate if product can be added to cart
   */
  validateAddToCart(
    product: ProductModel,
    variant: ProductVariant | null,
    options: AddToCartOptions
  ): CartValidationResult {
    // Check if product exists
    if (!product || !product.id) {
      return { canAdd: false, reason: 'Invalid product' };
    }

    // Check if variant exists
    if (!variant || !variant.id) {
      return { canAdd: false, reason: 'No variant selected' };
    }

    // Validate product and variant data
    const productValidation = ProductUtils.validateProduct(product);
    if (!productValidation.valid) {
      return { canAdd: false, reason: 'Invalid product data' };
    }

    const variantValidation = ProductUtils.validateVariant(variant);
    if (!variantValidation.valid) {
      return { canAdd: false, reason: 'Invalid variant data' };
    }

    // Check quantity
    if (!options.quantity || options.quantity <= 0) {
      return { canAdd: false, reason: 'Invalid quantity' };
    }

    // Check stock if validation is enabled
    if (options.validateStock && !options.allowOutOfStock) {
      if (!ProductUtils.isInStock(variant)) {
        return { canAdd: false, reason: 'Product is out of stock' };
      }

      // Check if requested quantity exceeds available stock
      const currentInCart = this.cartService.getItemQuantity(product.id, variant.id);
      const totalRequested = currentInCart + options.quantity;
      
      if (totalRequested > variant.stock) {
        const available = variant.stock - currentInCart;
        return { 
          canAdd: false, 
          reason: `Only ${available} more items available`,
          maxAllowedQuantity: available
        };
      }
    }

    return { canAdd: true };
  }

  /**
   * Quick add to cart with default options
   */
  async quickAdd(product: ProductModel, variant: ProductVariant | null): Promise<boolean> {
    return this.addToCart(product, variant, { quantity: 1 });
  }

  /**
   * Add multiple items to cart with pricing validation
   */
  async addMultipleToCart(
    items: Array<{ product: ProductModel; variant: ProductVariant | null; quantity?: number }>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const item of items) {
      const success = await this.addToCart(item.product, item.variant, {
        quantity: item.quantity || 1,
        showSuccessMessage: false // We'll show a summary message
      });

      if (success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`Failed to add ${item.product.name}`);
      }
    }

    // Show summary message
    if (results.success > 0 && results.failed === 0) {
      this.toastr.success(`${results.success} items added to cart`, 'Success');
    } else if (results.success > 0 && results.failed > 0) {
      this.toastr.warning(
        `${results.success} items added, ${results.failed} failed`,
        'Partially Added'
      );
    } else if (results.failed > 0) {
      this.toastr.error(`Failed to add ${results.failed} items`, 'Error');
    }

    return results;
  }

  /**
   * Get maximum quantity that can be added to cart
   */
  getMaxAddableQuantity(product: ProductModel, variant: ProductVariant | null): number {
    if (!variant || !ProductUtils.isInStock(variant)) {
      return 0;
    }

    const currentInCart = this.cartService.getItemQuantity(product.id, variant.id);
    return Math.max(0, variant.stock - currentInCart);
  }

  /**
   * Check if more items can be added to cart
   */
  canAddMore(product: ProductModel, variant: ProductVariant | null): boolean {
    return this.getMaxAddableQuantity(product, variant) > 0;
  }

  /**
   * Get recommended quantity based on stock and cart contents
   */
  getRecommendedQuantity(product: ProductModel, variant: ProductVariant | null): number {
    const maxAddable = this.getMaxAddableQuantity(product, variant);
    return Math.min(1, maxAddable);
  }

  /**
   * Get cart status for a product variant
   */
  getCartStatus(product: ProductModel, variant: ProductVariant | null): {
    inCart: boolean;
    quantity: number;
    canAddMore: boolean;
    maxAddable: number;
    isLowStock: boolean;
  } {
    if (!variant) {
      return {
        inCart: false,
        quantity: 0,
        canAddMore: false,
        maxAddable: 0,
        isLowStock: false
      };
    }

    const inCart = this.cartService.isInCart(product.id, variant.id);
    const quantity = this.cartService.getItemQuantity(product.id, variant.id);
    const maxAddable = this.getMaxAddableQuantity(product, variant);
    const canAddMore = maxAddable > 0;
    const isLowStock = ProductUtils.isLowStock(variant);

    return {
      inCart,
      quantity,
      canAddMore,
      maxAddable,
      isLowStock
    };
  }

  /**
   * Generate success message for add to cart
   */
  private getSuccessMessage(product: ProductModel, variant: ProductVariant, quantity: number): string {
    const itemText = quantity === 1 ? 'item' : 'items';
    return `${quantity} ${itemText} of ${product.name} added to cart`;
  }

  /**
   * Handle cart actions with loading states
   */
  async handleCartAction<T>(
    action: () => Promise<T>,
    loadingStateKey: string,
    loadingStates: { [key: string]: boolean }
  ): Promise<T | null> {
    if (loadingStates[loadingStateKey]) {
      return null; // Already in progress
    }

    loadingStates[loadingStateKey] = true;

    try {
      const result = await action();
      return result;
    } catch (error) {
      console.error('Cart action failed:', error);
      throw error;
    } finally {
      // Reset loading state after a delay for better UX
      setTimeout(() => {
        loadingStates[loadingStateKey] = false;
      }, 1000);
    }
  }

  /**
   * Batch validate multiple items
   */
  validateMultipleItems(
    items: Array<{ product: ProductModel; variant: ProductVariant | null; quantity?: number }>
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    items.forEach((item, index) => {
      const validation = this.validateAddToCart(item.product, item.variant, {
        quantity: item.quantity || 1,
        validateStock: true,
        allowOutOfStock: false
      });

      if (!validation.canAdd) {
        issues.push(`Item ${index + 1} (${item.product.name}): ${validation.reason}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get cart statistics with proper pricing using PricingService
   */
  getCartStats(): {
    itemCount: number;
    uniqueProducts: number;
    subtotal: number;
    totalSavings: number;
    isEmpty: boolean;
  } {
    return {
      itemCount: this.cartService.getItemCount(),
      uniqueProducts: this.cartService.getUniqueProductCount(),
      subtotal: this.cartService.getSubtotal(), // Now uses effective prices
      totalSavings: this.cartService.getTotalSavings(), // Now uses PricingService
      isEmpty: this.cartService.isEmpty()
    };
  }

  /**
   * Calculate cart total with effective pricing
   */
  calculateCartTotal(shippingCost: number = 0, taxRate: number = 0): CartTotalDetails {
    const cartItems = this.cartService.getCartItemsWithPriceBreakdown();
    
    // Calculate totals using effective prices - avoiding arrow function context issues
    let subtotal = 0;
    let totalSavings = 0;
    
    for (const item of cartItems) {
      subtotal += item.totalPrice;
      totalSavings += item.savings;
    }
    
    const originalSubtotal = subtotal + totalSavings;
    const tax = subtotal * taxRate;
    const total = subtotal + shippingCost + tax;

    return {
      subtotal,
      shipping: shippingCost,
      tax,
      total,
      totalSavings,
      originalSubtotal
    };
  }

  /**
   * Get item pricing details using PricingService
   */
  getItemPricingDetails(variant: ProductVariant | null, quantity: number = 1): ItemPricingDetails {
    const pricingInfo = this.pricingService.getVariantPricingInfo(variant);
    
    return {
      hasDiscount: pricingInfo.hasDiscount,
      originalPrice: pricingInfo.originalPrice,
      effectivePrice: pricingInfo.effectivePrice,
      totalPrice: pricingInfo.effectivePrice * quantity,
      savings: pricingInfo.savings * quantity,
      discountPercentage: pricingInfo.discountPercentage
    };
  }

  /**
   * Check if cart qualifies for free shipping
   */
  qualifiesForFreeShipping(threshold: number = 200): FreeShippingDetails {
    const currentTotal = this.cartService.getSubtotal();
    const qualifies = currentTotal >= threshold;
    const amountNeeded = Math.max(0, threshold - currentTotal);
    const progress = Math.min(100, (currentTotal / threshold) * 100);

    return {
      qualifies,
      currentTotal,
      amountNeeded,
      progress
    };
  }

  /**
   * Get detailed cart summary
   */
  getDetailedCartSummary(): {
    items: Array<{
      product: ProductModel;
      variant: ProductVariant;
      quantity: number;
      pricing: ItemPricingDetails;
    }>;
    totals: CartTotalDetails;
    freeShipping: FreeShippingDetails;
  } {
    // Get cart items through public method
    const cartItems = this.cartService.getCurrentCartItems();
    
    // Use for loop to avoid arrow function context issues
    const items: Array<{
      product: ProductModel;
      variant: ProductVariant;
      quantity: number;
      pricing: ItemPricingDetails;
    }> = [];
    
    for (const item of cartItems) {
      items.push({
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        pricing: this.getItemPricingDetails(item.variant, item.quantity)
      });
    }

    const totals = this.calculateCartTotal();
    const freeShipping = this.qualifiesForFreeShipping();

    return {
      items,
      totals,
      freeShipping
    };
  }
}