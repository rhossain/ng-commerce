import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ProductCategory } from '../models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl: string;
  // Cache keys and TTL (5 minutes)
  private readonly CATEGORIES_CACHE_KEY = 'ngc-categories';
  private readonly COUNTS_CACHE_KEY = 'ngc-category-counts';
  private readonly CACHE_EXPIRY_MINUTES = 30;
  private readonly CACHE_TTL = this.CACHE_EXPIRY_MINUTES * 60 * 1000;

  constructor(private http: HttpClient) { 
    this.apiUrl = environment.apiBaseUrl;
  }

  getAllCategories(): Observable<ProductCategory[]> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.category.getAllCategory}`;
    const cachedData = this.getCache<ProductCategory[]>(this.CATEGORIES_CACHE_KEY);

    // Return cached data if valid
    if (cachedData && !this.isCacheExpired(cachedData)) {
      return of(cachedData.data);
    }

    return this.http.get<ProductCategory[]>(url).pipe(
      tap(data => {
        this.setCache(this.CATEGORIES_CACHE_KEY, data);
      }),
      catchError(error => {
        // Fallback to expired cache if available
        if (cachedData) {
          return of(cachedData.data);
        }
        return throwError(() => error);
      })
    );
  }

  getCategoryProductCounts(): Observable<{ category_id: number; count: number }[]> {
    const url = `${this.apiUrl}/${environment.apiEndpoints.category.getCategoryProductCount}`;
    const cachedData = this.getCache<{ category_id: number; count: number }[]>(this.COUNTS_CACHE_KEY);

    // Return cached data if valid
    if (cachedData && !this.isCacheExpired(cachedData)) {
      return of(cachedData.data);
    }

    return this.http.get<{ category_id: number; count: number }[]>(url).pipe(
      tap(data => {
        this.setCache(this.COUNTS_CACHE_KEY, data);
      }),
      catchError(error => {
        // Fallback to expired cache if available
        if (cachedData) {
          return of(cachedData.data);
        }
        return throwError(() => error);
      })
    );
  }

  getCategoryNameById(id: number, categories: ProductCategory[]): string {
    const category = categories.find(c => c.id === id);
    return category?.name || 'Unknown';
  }

  // Helper method to get cached data
  private getCache<T>(key: string): { data: T; timestamp: number } | null {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }

  // Helper method to set cache
  private setCache<T>(key: string, data: T): void {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  }

  // Helper method to check cache expiration
  private isCacheExpired(cache: { timestamp: number }): boolean {
    return Date.now() - cache.timestamp > this.CACHE_TTL;
  }
}