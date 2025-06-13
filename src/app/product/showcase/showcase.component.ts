import { Component, Input, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwiperOptions } from 'swiper/types';
import { ProductModel } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { ProductCacheService } from '../../services/product-cache.service';
import { CardComponent } from '../card/card.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-product-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule, CardComponent],
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ShowcaseComponent implements OnInit {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() layout: 'grid' | 'list' | 'slider' = 'grid';
  @Input() filterType: 'featured' | 'new' | 'best-sell' | 'discounted' = 'featured';
  @Input() limit: number = 0; // 0 = no limit
  @Input() showViewAll: boolean = true;
  products: ProductModel[] = [];
  loading = true;

  constructor(private productCacheService: ProductCacheService) {}
  
  ngOnInit(): void {
    this.loadProducts();
  }

  swiperConfig: SwiperOptions = {
    slidesPerView: 1.2,
    spaceBetween: 16,
    breakpoints: {
      640: { slidesPerView: 2 },
      768: { slidesPerView: 3 },
      1024: { slidesPerView: 4 },
    },
    loop: true,
    grabCursor: true,
  };

  private loadProducts(): void {
    this.loading = true;

    this.productCacheService.getPaginatedProducts(
      1,
      this.limit || 6,
      'id',
      'asc',
      undefined,
      undefined,
      undefined,
      this.filterType
    )
      .then(response => {
        this.products = response.items;
        this.loading = false;
      })
      .catch(() => {
        this.loading = false;
      });
  }  
}
