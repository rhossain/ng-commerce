import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ProductModel } from '../models/product.model';
import { ProductCacheService } from './product-cache.service';
import { QuickviewComponent } from '../product/quickview/quickview.component';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class QuickviewService {
  constructor(
    private modalService: NgbModal,
    private productCacheService: ProductCacheService
  ) {}

  /**
   * Open quickview modal for a product
   */
  openQuickview(productId: number): Observable<ProductModel> | null {
    // Get product from cache
    const product$ = this.productCacheService.getProductById(productId);
    
    if (!product$) {
      console.error('Product not found in cache:', productId);
      return null;
    }

    product$.subscribe(product => {
      if (product) {
        this.showQuickviewModal(product);
      }
    });

    return product$;
  }

  /**
   * Show quickview modal with product data
   */
  private showQuickviewModal(product: ProductModel): NgbModalRef {
    const modalRef = this.modalService.open(QuickviewComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      keyboard: true,
      windowClass: 'quickview-modal'
    });

    modalRef.componentInstance.product = product;
    
    return modalRef;
  }

  /**
   * Open quickview with product object directly
   */
  openQuickviewWithProduct(product: ProductModel): NgbModalRef {
    return this.showQuickviewModal(product);
  }
}