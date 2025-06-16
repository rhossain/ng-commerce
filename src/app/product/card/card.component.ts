import { Component, ElementRef, Input, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCartPlus, faRightLeft } from '@fortawesome/free-solid-svg-icons';
import { faEye, faHeart } from '@fortawesome/free-regular-svg-icons';
import { ToastrService } from 'ngx-toastr';
import { ProductModel } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { ImageCacheService } from '../../services/image-cache.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterModule, CommonModule, FontAwesomeModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss'
})
export class CardComponent implements AfterViewInit {
  @Input() product!: ProductModel;
  @Input() isLoading = false;
  @ViewChild('imageEl', { static: false }) imageEl!: ElementRef;
  
  imageVisible = false;
  imageUrl = '';
  quantity: number = 1;
  isAddingToCart = false;

  // Default fallback image path
  fallbackUrl = 'assets/images/image-not-loaded.jpg';

  // Icons
  faCartPlus = faCartPlus;
  faEye = faEye;
  faHeart = faHeart;
  faRightLeft = faRightLeft;

  constructor(
    private cartService: CartService,
    private toastr: ToastrService,
    private imageCacheService: ImageCacheService
  ) {}

  ngAfterViewInit() {
    setTimeout(() => {
      if (!this.imageEl) return;
  
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            // console.log('Intersection entry:', entry);
            if (entry.isIntersecting) {
              // console.log('Card in view — loading image...');
              this.loadImageWithFallback();
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );
  
      observer.observe(this.imageEl.nativeElement);
    }, 0);
  }
  
  loadImageWithFallback(): void {
    const imgUrl = this.product.variants?.[0]?.product_images?.[0]?.image_url || '';
    const fallbackUrl = this.fallbackUrl;
    const timeoutMs = 10000;
  
    if (!imgUrl) {
      this.imageUrl = fallbackUrl;
      this.imageVisible = true;
      return;
    }
  
    let didLoad = false;
  
    const timeout = setTimeout(() => {
      if (!didLoad) {
        // console.warn('Image load timed out — using fallback');
        this.imageUrl = fallbackUrl;
        this.imageVisible = true;
      }
    }, timeoutMs);
  
    this.imageCacheService.preloadImage(imgUrl)
      .then(img => {
        if (!didLoad) {
          didLoad = true;
          clearTimeout(timeout);
          this.imageUrl = img.src;
          this.imageVisible = true;
        }
      })
      .catch(() => {
        if (!didLoad) {
          didLoad = true;
          clearTimeout(timeout);
          this.imageUrl = fallbackUrl;
          this.imageVisible = true;
        }
      });
  }
  

  // addToCart(product: ProductModel): void {
  //   const selectedVariant = product.variants?.[0];
  //   if (selectedVariant) {
  //     this.cartService.addToCart(product, selectedVariant);
  //   }
  // }

  async addToCart(): Promise<void> {
    if (this.isAddingToCart) return;
    
    this.isAddingToCart = true;
    
    try {
      const selectedVariant = this.product.variants?.[0];
      
      if (!selectedVariant) {
        this.toastr.warning('No variant available for this product', 'Cannot Add to Cart');
        return;
      }

      await this.cartService.addToCart(this.product, selectedVariant, this.quantity);
      // this.toastr.success(`${this.product.name} added to cart`, 'Success');
      this.quantity = 1; // Reset quantity after adding
    } catch (error) {
      this.toastr.error('Failed to add item to cart', 'Error');
    } finally {
      this.isAddingToCart = false;
    }
  }

  incrementQuantity(): void {
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  clearCart(): void {
    this.cartService.clearCart();
    this.toastr.info('Cart has been cleared', 'Cart Empty');
  }
}
