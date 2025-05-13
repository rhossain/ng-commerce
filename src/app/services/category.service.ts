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
}
