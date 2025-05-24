import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductModel } from '../../models/product.model';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss'
})
export class CardComponent {
  @Input() product!: ProductModel;
  @Input() isLoading = false;
  @ViewChild('bgImageEl', { static: false }) bgImageEl!: ElementRef;
  imageVisible = false;
  backgroundUrl = '';

  // Default fallback image path
  fallbackUrl = 'https://placehold.co/400x400/48A6A7/FFF?text=Fallback';

  constructor(private cartService: CartService) {}

  addToCart(product: ProductModel): void {
    const selectedVariant = product.variants?.[0]; // or show UI to pick one
    if (selectedVariant) {
      this.cartService.addToCart(product, selectedVariant);
    }
  }

  clearCart():void {
    this.cartService.clearCart();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (!this.bgImageEl) return;
  
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
  
      observer.observe(this.bgImageEl.nativeElement);
    }, 0);
  }
  
  loadImageWithFallback(): void {
    const imgUrl = this.product.variants?.[0]?.product_images?.[0]?.image_url || '';
    const fallbackUrl = this.fallbackUrl;
    const timeoutMs = 10000;
  
    const img = new Image();
    let didLoad = false;
  
    // Set a timeout to trigger fallback
    const timeout = setTimeout(() => {
      if (!didLoad) {
        // console.warn('Image load timed out — using fallback');
        this.backgroundUrl = fallbackUrl;
        this.imageVisible = true;
      }
    }, timeoutMs);
  
    img.onload = () => {
      didLoad = true;
      clearTimeout(timeout);
      // console.log('Image loaded successfully');
      this.backgroundUrl = imgUrl;
      this.imageVisible = true;
    };
  
    img.onerror = () => {
      didLoad = true;
      clearTimeout(timeout);
      // console.warn('Image failed — using fallback');
      this.backgroundUrl = fallbackUrl;
      this.imageVisible = true;
    };
  
    img.src = imgUrl;
  }
}
