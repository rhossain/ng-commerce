import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductModel, ProductResponse } from '../models/product.model';

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
}
