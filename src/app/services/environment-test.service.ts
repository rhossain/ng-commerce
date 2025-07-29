import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentTestService {
  constructor(private http: HttpClient) {}

  // Test if endpoints exist
  testShippingEndpoints() {
    console.log('Testing shipping endpoints...');
    
    const baseUrl = environment.apiBaseUrl;
    const endpoints = environment.apiEndpoints.shipping;
    
    // Test shipping methods endpoint
    const methodsUrl = `${baseUrl}/${endpoints.getShippingMethods}`;
    console.log('Testing shipping methods URL:', methodsUrl);
    
    this.http.get(methodsUrl).subscribe({
      next: (data) => console.log('✅ Shipping methods endpoint works:', data),
      error: (error) => console.error('❌ Shipping methods endpoint failed:', error)
    });
    
    // Test user addresses endpoint
    const addressesUrl = `${baseUrl}/${endpoints.getUserAddresses}`;
    console.log('Testing user addresses URL:', addressesUrl);
    
    this.http.get(addressesUrl).subscribe({
      next: (data) => console.log('✅ User addresses endpoint works:', data),
      error: (error) => console.error('❌ User addresses endpoint failed:', error)
    });
  }
}