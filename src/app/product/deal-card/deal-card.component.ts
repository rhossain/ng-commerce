import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductModel, ProductVariant } from '../../models/product.model';
import { ProductCacheService } from '../../services/product-cache.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-deal-card',
  imports: [CommonModule],
  templateUrl: './deal-card.component.html',
  styleUrl: './deal-card.component.scss',
  standalone: true
})
export class DealCardComponent implements OnInit, OnDestroy {
  @Input() productIds: number[] = [];
  @Input() dealEndTime: string = '2025-06-15T23:59:59';

  products: ProductModel[] = [];
  timeLeft: any = {};
  private intervalId: any;

  constructor(
    private productCacheService: ProductCacheService,
    private cartService: CartService
  ) {}
  
  async ngOnInit() {
    await this.loadProducts();
    this.startTimer();
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  async loadProducts() {
    this.productCacheService.getAllProducts().subscribe((all) => {
      this.products = all.filter(p => this.productIds.includes(p.id));
    });
  }  

  startTimer() {
    this.updateTime();
    this.intervalId = setInterval(() => this.updateTime(), 1000);
  }

  updateTime() {
    const end = new Date(this.dealEndTime).getTime();
    const now = new Date().getTime();
    const diff = Math.max(end - now, 0);

    const format = (val: number) => val.toString().padStart(2, '0');

    this.timeLeft = {
      days: format(Math.floor(diff / (1000 * 60 * 60 * 24))),
      hours: format(Math.floor((diff / (1000 * 60 * 60)) % 24)),
      minutes: format(Math.floor((diff / (1000 * 60)) % 60)),
      seconds: format(Math.floor((diff / 1000) % 60)),
    };
  }

  getDiscountPercent(price?: number, discountPrice?: number): number | null {
    if (price == null || discountPrice == null || discountPrice >= price) return null;
    return Math.round(((price - discountPrice) / price) * 100);
  }

  addToCart(product: ProductModel) {
    const variant = product.variants?.[0];
    if (variant) this.cartService.addToCart(product, variant, 1);
  }
}
