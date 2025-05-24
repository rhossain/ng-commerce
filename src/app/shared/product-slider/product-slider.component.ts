import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ProductModel, ProductVariant } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { SwiperOptions } from 'swiper/types';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-product-slider',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-slider.component.html',
  styleUrl: './product-slider.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductSliderComponent implements OnInit {
  @Input() productIds: number[] = [];
  // products: ProductModel[] = [];
  loadingImages: boolean[] = [];

  products: { product: ProductModel; variant: ProductVariant | null }[] = [];
  sliderConfig: SwiperOptions = {
    slidesPerView: 1,
    spaceBetween: 20,
    // navigation: true,
    // pagination: { clickable: true },
    loop: true,
    autoplay: { delay: 3000 },
    allowTouchMove: true,
    // If we need pagination
    pagination: {
      el: '.swiper-pagination',
    },

    // Navigation arrows
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },

    // And if we need scrollbar
    scrollbar: {
      el: '.swiper-scrollbar',
    },
  };

  constructor(private productService: ProductService) {}
  
  ngOnInit(): void {
    this.loadProducts();
    console.log(this.products);

    // if (this.productIds.length) {
    //   const requests = this.productIds.map(id => this.productService.getProduct(id));
    //   forkJoin(requests).subscribe((products) => {
    //     this.products = products.map(p => {
    //       const firstVariant = p.variants?.[0] || null;
    //       return { product: p, variant: firstVariant };
    //     });
    //   });
    // }
  }

  loadProducts(): void {
    if (!this.productIds?.length) return;
    const requests = this.productIds.map(id => this.productService.getProduct(id));
    forkJoin(requests).subscribe((products) => {
      this.products = products.map(p => {
        const firstVariant = p.variants?.[0] || null;
        return { product: p, variant: firstVariant };
      });

      // Initialize all loading states to true
      this.loadingImages = Array(this.products.length).fill(true);
    });
  }
}
