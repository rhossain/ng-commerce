import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductCategory } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl: string;

  constructor(private http:HttpClient) { 
    this.apiUrl = environment.apiBaseUrl;
  }

  getAllCategories(): Observable<ProductCategory[]> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.category.getAllCategory}`;
    return this.http.get<ProductCategory[]>(url);
  }

  getCategoryProductCounts(): Observable<{ category_id: number; count: number }[]> {
    return this.http.get<{ category_id: number; count: number }[]>(`${this.apiUrl}/${environment.apiEndpoints.category.getCategoryProductCount}`);
  }

  getCategoryNameById(id: number, categories: ProductCategory[]): string {
    const category = categories.find(c => c.id === id);
    return category?.name || 'Unknown';
  }
}