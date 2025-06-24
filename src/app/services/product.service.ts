import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductModel, ProductResponse, ProductReview } from '../models/product.model';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private apiUrl: string;

  constructor(private http: HttpClient) {
    this.apiUrl = environment.apiBaseUrl;
  }

  getProduct(id: number): Observable<ProductModel> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.getProduct}/${id}`;
    return this.http.get<ProductModel>(url);
  }

  getProducts(
    page: number = 1,
    perPage: number = 1,
    sortBy: string = 'id',
    orderBy: 'asc' | 'desc' = 'asc',
    categoryId?: number | null,
    limit?: number,
    minPrice?: number | null,
    maxPrice?: number | null
  ): Observable<ProductResponse> {
    let url = `${this.apiUrl}/${environment.apiEndpoints.product.getAllProduct}?page=${page}&perPage=${perPage}&sortBy=${sortBy}&orderBy=${orderBy}`;

    if (categoryId) url += `&categoryId=${categoryId}`;
    if (limit) url += `&perPage=${limit}`;
    if (minPrice != null) url += `&minPrice=${minPrice}`;
    if (maxPrice != null) url += `&maxPrice=${maxPrice}`;
    console.log('Final product API URL:', url);
    // console.log(url);
    return this.http.get<ProductResponse>(url);
  }

  getFeaturedProducts(): Observable<ProductResponse> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.getFeaturedProduct}`;
    return this.http.get<ProductResponse>(url);
  }

  getNewProducts(): Observable<ProductResponse> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.getNewProduct}`;
    return this.http.get<ProductResponse>(url);
  }

  getAverageRating(reviews: ProductReview[] | undefined): number {
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }

  submitReview(reviewPayload: any): Observable<any> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.addReview}`;
    return this.http.post(url, reviewPayload);
  }

  updateReview(reviewId: number, updatedReview: any): Observable<any> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.updateReview}/${reviewId}`;
    return this.http.patch(url, updatedReview);
  }

  deleteReview(reviewId: number): Observable<any> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.product.deleteReview}/${reviewId}`;
    return this.http.delete(url);
  }
}
