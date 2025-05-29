import { Component, ElementRef, Input, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCartPlus, faRightLeft } from '@fortawesome/free-solid-svg-icons';
import { faEye, faHeart } from '@fortawesome/free-regular-svg-icons';
import { ProductModel } from '../../models/product.model';
import { CartService } from '../../services/cart.service';

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

  // Default fallback image path
  fallbackUrl = 'https://placehold.co/400x400/48A6A7/FFF?text=Fallback';

  // Icons
  faCartPlus = faCartPlus;
  faEye = faEye;
  faHeart = faHeart;
  faRightLeft = faRightLeft;

  constructor(private cartService: CartService) {}

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
  
    const img = new Image();
    let didLoad = false;
  
    // Set a timeout to trigger fallback
    const timeout = setTimeout(() => {
      if (!didLoad) {
        // console.warn('Image load timed out — using fallback');
        this.imageUrl = fallbackUrl;
        this.imageVisible = true;
      }
    }, timeoutMs);
  
    img.onload = () => {
      didLoad = true;
      clearTimeout(timeout);
      // console.log('Image loaded successfully');
      this.imageUrl = imgUrl;
      this.imageVisible = true;
    };
  
    img.onerror = () => {
      didLoad = true;
      clearTimeout(timeout);
      // console.warn('Image failed — using fallback');
      this.imageUrl = fallbackUrl;
      this.imageVisible = true;
    };
  
    img.src = imgUrl;
  }

  addToCart(product: ProductModel): void {
    const selectedVariant = product.variants?.[0];
    if (selectedVariant) {
      this.cartService.addToCart(product, selectedVariant);
    }
  }

  clearCart():void {
    this.cartService.clearCart();
  }
}
