import { Component, Input, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwiperOptions } from 'swiper/types';
import { ProductModel } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { CardComponent } from '../card/card.component';

@Component({
  selector: 'app-product-showcase',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ShowcaseComponent implements OnInit {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() layout: 'grid' | 'list' | 'slider' = 'grid';
  @Input() filterType: 'featured' | 'new' | 'best-sell' = 'featured';
  @Input() limit: number = 0; // 0 = no limit
  products: ProductModel[] = [];
  isLoading = true;

  constructor(private productService: ProductService) {}
  
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
    const fetchCount = 100; // Arbitrary large number, not limited by input
  
    this.productService.getProducts(1, fetchCount, 'id', 'desc').subscribe(res => {
      let filtered = res.items || [];
  
      if (this.filterType === 'featured') {
        filtered = filtered.filter(p => p.isFeatured || (p as any)['is_featured']);
      } else if (this.filterType === 'new') {
        filtered = filtered.filter(p => p.isNewArrival || (p as any)['is_new_arrival']);
      } else if (this.filterType === 'best-sell') {
        filtered = filtered
          .filter(p => p.variants?.length && p.variants[0]?.totalSold != null)
          .sort((a, b) => {
            const soldA = a.variants?.[0]?.totalSold ?? 0;
            const soldB = b.variants?.[0]?.totalSold ?? 0;
            return soldB - soldA;
          });
      }
  
      // ✅ Apply final limit after filtering
      this.products = this.limit > 0 ? filtered.slice(0, this.limit) : filtered;
  
      this.isLoading = false;
    });
  }
}
