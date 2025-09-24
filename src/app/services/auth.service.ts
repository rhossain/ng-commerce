import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UserModel } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:xGHHfAj6';
  private tokenKey = 'auth_token';

  private userSubject = new BehaviorSubject<UserModel | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${environment.apiEndpoints.auth.setLogin}`, { email, password }).pipe(
      tap((res: any) => {
        this.saveToken(res.authToken);
        this.getCurrentUser().subscribe();
      })
    );
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
    this.userSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): Observable<UserModel> {
    return this.http.get<UserModel>(`${this.apiUrl}/${environment.apiEndpoints.auth.getProfile}`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    }).pipe(
      tap(user => {
        this.userSubject.next(user);
        localStorage.setItem('user_info', JSON.stringify(user));
      })
    );
  }

  // To get instant access to the user object without needing to subscribe
  getCurrentUserSync(): UserModel | null {
    const userData = localStorage.getItem('user_info');
    if (userData) {
      return JSON.parse(userData) as UserModel;
    }
    return null;
  }

  getUserId(): number | null {
    const userData = localStorage.getItem('user_info');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id || null;
    }
    return null;
  }

  getUserName(): string | null {
    const userData = localStorage.getItem('user_info');
    if (userData) {
      const user = JSON.parse(userData);
      return user.name || null;
    }
    return null;
  }

  loadUserFromStorage(): void {
    const userData = localStorage.getItem('user_info');
    if (userData && this.isLoggedIn()) {
      this.userSubject.next(JSON.parse(userData));
    } else if (this.isLoggedIn()) {
      this.getCurrentUser().subscribe();
    }
  }
}