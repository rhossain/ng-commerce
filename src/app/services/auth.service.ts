import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserModel } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl: string;
  private tokenKey = 'auth_token';

  constructor(private http: HttpClient) {
    // this.apiUrl = environment.apiBaseUrl;
    this.apiUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:xGHHfAj6';
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${environment.apiEndpoints.auth.setLogin}`, { email, password });
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${environment.apiEndpoints.auth.setSignup}`, data);
  }

  saveToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): Observable<UserModel> {
    return this.http.get<UserModel>(`${this.apiUrl}/${environment.apiEndpoints.auth.getProfile}`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    });
  }
}