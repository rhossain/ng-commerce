// shipping.service.ts - Optimized version with performance improvements
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, catchError, map, shareReplay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ShippingMethod, ShippingAddress, ShippingStatus } from '../models/order.model';

interface ShippingCalculation {
  methodId: number;
  cartTotal: number;
  cost: number;
  isFreeShipping: boolean;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingService {
  private apiUrl: string;
  
  private shippingMethodsSubject = new BehaviorSubject<ShippingMethod[]>([]);
  shippingMethods$ = this.shippingMethodsSubject.asObservable().pipe(
    shareReplay(1) // Cache the latest emission
  );
  
  private userAddressesSubject = new BehaviorSubject<ShippingAddress[]>([]);
  userAddresses$ = this.userAddressesSubject.asObservable().pipe(
    shareReplay(1) // Cache the latest emission
  );

  // ✅ Performance optimizations
  private shippingCalculationCache = new Map<string, ShippingCalculation>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  
  // ✅ Debounced observables for cart changes
  private cartTotalSubject = new BehaviorSubject<number>(0);
  public cartTotal$ = this.cartTotalSubject.asObservable().pipe(
    debounceTime(300), // Wait 300ms after last emission
    distinctUntilChanged(), // Only emit when value actually changes
    shareReplay(1)
  );

  // ✅ Track loading states
  private loadingStates = {
    addresses: false,
    methods: false
  };

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private authService: AuthService
  ) {
    this.apiUrl = environment.apiBaseUrl;
    console.log('🚚 ShippingService initialized with URL:', this.apiUrl);
    
    // ✅ Cleanup cache periodically
    this.startCacheCleanup();
  }

  // ✅ Get HTTP headers with auth token (cached)
  private _cachedHeaders: { headers: HttpHeaders; timestamp: number } | null = null;
  private readonly HEADER_CACHE_DURATION = 60 * 1000; // 1 minute

  private getHttpHeaders(): HttpHeaders {
    const now = Date.now();
    
    // ✅ Return cached headers if still valid
    if (this._cachedHeaders && (now - this._cachedHeaders.timestamp) < this.HEADER_CACHE_DURATION) {
      return this._cachedHeaders.headers;
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    // ✅ Cache the headers
    this._cachedHeaders = {
      headers,
      timestamp: now
    };

    return headers;
  }

  // ✅ Update cart total (with debouncing)
  updateCartTotal(total: number): void {
    this.cartTotalSubject.next(total);
  }

  // ✅ Get user shipping addresses from Xano (with caching)
  getUserShippingAddresses(forceRefresh: boolean = false): Observable<ShippingAddress[]> {
    // ✅ Return cached data if available and not forcing refresh
    if (!forceRefresh && this.userAddressesSubject.value.length > 0 && !this.loadingStates.addresses) {
      return of(this.userAddressesSubject.value);
    }

    // ✅ Prevent multiple simultaneous requests
    if (this.loadingStates.addresses) {
      return this.userAddresses$;
    }

    this.loadingStates.addresses = true;
    console.log('📍 Fetching user shipping addresses...');
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.shipping.getUserAddresses}`;
    const headers = this.getHttpHeaders();
    
    return this.http.get<ShippingAddress[]>(url, { headers }).pipe(
      tap(response => {
        console.log('✅ Addresses loaded successfully');
        
        // ✅ Handle different Xano response formats
        let addresses: ShippingAddress[] = [];
        
        if (Array.isArray(response)) {
          addresses = response;
        } else if (response && typeof response === 'object') {
          addresses = (response as any).data || (response as any).addresses || [response];
        }
        
        // ✅ Process and validate addresses
        const processedAddresses = addresses.map(addr => ({
          id: addr.id,
          created_at: addr.created_at || Date.now(),
          first_name: addr.first_name || '',
          last_name: addr.last_name || '',
          company: addr.company || '',
          address_line_1: addr.address_line_1 || '',
          address_line_2: addr.address_line_2 || '',
          city: addr.city || '',
          state: addr.state || '',
          zip_code: addr.zip_code || '',
          country: addr.country || 'US',
          phone: addr.phone || '',
          delivery_instructions: addr.delivery_instructions || '',
          is_validated: addr.is_validated ?? false,
          is_active: addr.is_active ?? false,
          user_id: addr.user_id || this.authService.getUserId() || 0
        }));
        
        // ✅ Sort addresses: active first, then by creation date
        const sortedAddresses = processedAddresses.sort((a, b) => {
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          return (b.created_at || 0) - (a.created_at || 0);
        });
        
        this.userAddressesSubject.next(sortedAddresses);
        
        // ✅ Show toast only for manual refreshes
        if (forceRefresh) {
          this.toastr.success(`${sortedAddresses.length} addresses loaded`, 'Addresses');
        }
      }),
      catchError(error => {
        console.error('❌ Error fetching addresses:', error);
        this.handleAddressError(error, 'fetch');
        this.userAddressesSubject.next([]);
        return of([]);
      }),
      tap(() => {
        this.loadingStates.addresses = false;
      }),
      shareReplay(1)
    );
  }

  // ✅ Get shipping methods from Xano (with caching)
  getShippingMethods(forceRefresh: boolean = false): Observable<ShippingMethod[]> {
    // ✅ Return cached data if available and not forcing refresh
    if (!forceRefresh && this.shippingMethodsSubject.value.length > 0 && !this.loadingStates.methods) {
      return of(this.shippingMethodsSubject.value);
    }

    // ✅ Prevent multiple simultaneous requests
    if (this.loadingStates.methods) {
      return this.shippingMethods$;
    }

    this.loadingStates.methods = true;
    console.log('🚛 Fetching shipping methods...');
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.shipping.getShippingMethods}`;
    const headers = this.getHttpHeaders();
    
    return this.http.get<ShippingMethod[]>(url, { headers }).pipe(
      tap(response => {
        console.log('✅ Shipping methods loaded successfully');
        
        // ✅ Handle different Xano response formats
        let methods: ShippingMethod[] = [];
        
        if (Array.isArray(response)) {
          methods = response;
        } else if (response && typeof response === 'object') {
          methods = (response as any).data || (response as any).methods || [response];
        }
        
        // ✅ Process and validate shipping methods
        const processedMethods = methods.map(method => ({
          id: method.id,
          created_at: method.created_at || Date.now(),
          name: method.name || 'Standard Shipping',
          type: method.type || 'standard',
          carrier: method.carrier || 'USPS',
          base_cost: Number(method.base_cost) || 0,
          estimated_delivery_days: method.estimated_delivery_days || '5-7 business days',
          free_shipping_threshold: Number(method.free_shipping_threshold) || 0,
          is_active: method.is_active ?? true,
          max_weight: method.max_weight,
          description: method.description
        }));
        
        // ✅ Filter only active methods
        const activeMethods = processedMethods.filter(method => method.is_active);
        
        this.shippingMethodsSubject.next(activeMethods);
        
        // ✅ Show toast only for manual refreshes
        if (forceRefresh) {
          this.toastr.success(`${activeMethods.length} shipping methods loaded`, 'Shipping');
        }
      }),
      catchError(error => {
        console.error('❌ Error fetching shipping methods:', error);
        
        // ✅ Return default shipping methods if Xano table doesn't exist
        const defaultMethods: ShippingMethod[] = [
          {
            id: 1,
            created_at: Date.now(),
            name: 'Standard Shipping',
            type: 'standard',
            carrier: 'USPS',
            base_cost: 5.99,
            estimated_delivery_days: '5-7 business days',
            free_shipping_threshold: 50,
            is_active: true
          },
          {
            id: 2,
            created_at: Date.now(),
            name: 'Express Shipping',
            type: 'express',
            carrier: 'FedEx',
            base_cost: 12.99,
            estimated_delivery_days: '2-3 business days',
            free_shipping_threshold: 100,
            is_active: true
          },
          {
            id: 3,
            created_at: Date.now(),
            name: 'Overnight Shipping',
            type: 'overnight',
            carrier: 'FedEx',
            base_cost: 24.99,
            estimated_delivery_days: '1 business day',
            free_shipping_threshold: 200,
            is_active: true
          }
        ];
        
        this.shippingMethodsSubject.next(defaultMethods);
        
        if (forceRefresh) {
          this.toastr.warning('Using default shipping methods', 'Warning');
        }
        
        return of(defaultMethods);
      }),
      tap(() => {
        this.loadingStates.methods = false;
      }),
      shareReplay(1)
    );
  }

  // ✅ Create new shipping address in Xano
  createShippingAddress(address: Omit<ShippingAddress, 'id' | 'created_at' | 'user_id'>): Observable<ShippingAddress> {
    console.log('➕ Creating new shipping address...');
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.shipping.createAddress}`;
    const headers = this.getHttpHeaders();
    
    // ✅ Add required fields for Xano
    const addressData = {
      ...address,
      user_id: this.authService.getUserId(),
      created_at: Date.now()
    };
    
    return this.http.post<ShippingAddress>(url, addressData, { headers }).pipe(
      tap(newAddress => {
        console.log('✅ Address created:', newAddress.id);
        
        // ✅ If this address is set as active, deactivate others
        if (newAddress.is_active) {
          this.deactivateOtherAddresses(newAddress.id);
        }
        
        // ✅ Add to local cache
        const currentAddresses = this.userAddressesSubject.value;
        this.userAddressesSubject.next([newAddress, ...currentAddresses]);
        
        this.toastr.success('Address added successfully', 'Success');
      }),
      catchError(error => {
        console.error('❌ Error creating address:', error);
        this.handleAddressError(error, 'create');
        return throwError(() => error);
      })
    );
  }

  // ✅ Update shipping address in Xano
  updateShippingAddress(addressId: number, address: Partial<ShippingAddress>): Observable<ShippingAddress> {
    console.log('✏️ Updating shipping address:', addressId);
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.shipping.updateAddress}/${addressId}`;
    const headers = this.getHttpHeaders();
    
    return this.http.patch<ShippingAddress>(url, address, { headers }).pipe(
      tap(updatedAddress => {
        console.log('✅ Address updated:', updatedAddress.id);
        
        // ✅ If this address is set as active, deactivate others
        if (updatedAddress.is_active) {
          this.deactivateOtherAddresses(updatedAddress.id);
        }
        
        // ✅ Update local cache
        const currentAddresses = this.userAddressesSubject.value;
        const index = currentAddresses.findIndex(a => a.id === addressId);
        if (index !== -1) {
          currentAddresses[index] = updatedAddress;
          this.userAddressesSubject.next([...currentAddresses]);
        }
        
        this.toastr.success('Address updated successfully', 'Success');
      }),
      catchError(error => {
        console.error('❌ Error updating address:', error);
        this.handleAddressError(error, 'update');
        return throwError(() => error);
      })
    );
  }

  // ✅ Delete shipping address from Xano
  deleteShippingAddress(addressId: number): Observable<void> {
    console.log('🗑️ Deleting shipping address:', addressId);
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.shipping.deleteAddress}/${addressId}`;
    const headers = this.getHttpHeaders();
    
    return this.http.delete<void>(url, { headers }).pipe(
      tap(() => {
        console.log('✅ Address deleted:', addressId);
        
        // ✅ Remove from local cache
        const currentAddresses = this.userAddressesSubject.value;
        this.userAddressesSubject.next(currentAddresses.filter(a => a.id !== addressId));
        
        this.toastr.success('Address deleted successfully', 'Success');
      }),
      catchError(error => {
        console.error('❌ Error deleting address:', error);
        this.toastr.error('Failed to delete address', 'Error');
        return throwError(() => error);
      })
    );
  }

  // ✅ Set default shipping address
  setDefaultAddress(addressId: number): Observable<ShippingAddress> {
    console.log('⭐ Setting default address:', addressId);
    
    const url = `${this.apiUrl}/${environment.apiEndpoints.shipping.setDefaultAddress}/${addressId}`;
    const headers = this.getHttpHeaders();
    
    return this.http.patch<ShippingAddress>(url, { is_active: true }, { headers }).pipe(
      tap(updatedAddress => {
        console.log('✅ Default address set:', updatedAddress.id);
        
        // ✅ Deactivate other addresses in cache
        this.deactivateOtherAddresses(addressId);
        
        this.toastr.success('Default address updated', 'Success');
      }),
      catchError(error => {
        console.error('❌ Error setting default address:', error);
        this.toastr.error('Failed to set default address', 'Error');
        return throwError(() => error);
      })
    );
  }

  // ✅ Calculate shipping cost with caching and optimized free shipping logic
  calculateShippingCost(methodId: number, cartTotal: number, shippingMethods?: ShippingMethod[]): number {
    // ✅ Create cache key
    const cacheKey = `${methodId}-${Math.round(cartTotal * 100) / 100}`; // Round to 2 decimal places for consistent caching
    
    // ✅ Check cache first
    const cached = this.shippingCalculationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.cost;
    }

    const methods = shippingMethods || this.shippingMethodsSubject.value;
    const method = methods.find(m => m.id === methodId);
    
    if (!method) {
      console.warn(`⚠️ Shipping method with ID ${methodId} not found`);
      return 0;
    }
    
    let cost = method.base_cost;
    let isFreeShipping = false;
    
    // ✅ Check if cart qualifies for free shipping (ONLY LOG ONCE PER CACHE CYCLE)
    if (method.free_shipping_threshold > 0 && cartTotal >= method.free_shipping_threshold) {
      cost = 0;
      isFreeShipping = true;
      
      // ✅ Only log if this is a new calculation (not cached)
      if (!cached) {
        console.log(`🎉 Free shipping qualified for ${method.name}! Cart: $${cartTotal}, Threshold: $${method.free_shipping_threshold}`);
      }
    }
    
    // ✅ Cache the result
    const calculation: ShippingCalculation = {
      methodId,
      cartTotal,
      cost,
      isFreeShipping,
      timestamp: Date.now()
    };
    
    this.shippingCalculationCache.set(cacheKey, calculation);
    
    // ✅ Limit cache size
    if (this.shippingCalculationCache.size > this.MAX_CACHE_SIZE) {
      this.cleanupOldCacheEntries();
    }
    
    return cost;
  }

  // ✅ Get shipping cost with observable pattern (for reactive updates)
  getShippingCostObservable(methodId: number): Observable<number> {
    return this.cartTotal$.pipe(
      map(cartTotal => this.calculateShippingCost(methodId, cartTotal)),
      distinctUntilChanged() // Only emit when cost actually changes
    );
  }

  // ✅ Get estimated delivery date
  getEstimatedDeliveryDate(shippingMethod: ShippingMethod, orderDate?: Date): Date {
    const baseDate = orderDate || new Date();
    const days = parseInt(shippingMethod.estimated_delivery_days.replace(/\D/g, '')) || 7;
    
    const deliveryDate = new Date(baseDate);
    deliveryDate.setDate(deliveryDate.getDate() + days);
    
    return deliveryDate;
  }

  // ✅ Format address for display (memoized)
  private addressDisplayCache = new Map<number, string>();
  
  formatAddressDisplay(address: ShippingAddress): string {
    // ✅ Use cache for formatting
    if (this.addressDisplayCache.has(address.id)) {
      return this.addressDisplayCache.get(address.id)!;
    }

    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.zip_code,
      address.country
    ].filter(Boolean);
    
    const formatted = parts.join(', ');
    this.addressDisplayCache.set(address.id, formatted);
    
    return formatted;
  }

  // ✅ Get shipping method by ID (optimized)
  getShippingMethodById(methodId: number): ShippingMethod | null {
    return this.shippingMethodsSubject.value.find(m => m.id === methodId) || null;
  }

  // ✅ Get active shipping address
  getActiveShippingAddress(): ShippingAddress | null {
    return this.userAddressesSubject.value.find(addr => addr.is_active) || null;
  }

  // ✅ Check if free shipping is available for cart total
  isFreeShippingAvailable(cartTotal: number): boolean {
    return this.shippingMethodsSubject.value.some(method => 
      method.free_shipping_threshold > 0 && cartTotal >= method.free_shipping_threshold
    );
  }

  // ✅ Get free shipping threshold for display
  getLowestFreeShippingThreshold(): number {
    const thresholds = this.shippingMethodsSubject.value
      .map(m => m.free_shipping_threshold)
      .filter(t => t > 0);
    
    return thresholds.length > 0 ? Math.min(...thresholds) : 0;
  }

  // ✅ Private helper methods
  private deactivateOtherAddresses(activeAddressId: number): void {
    const currentAddresses = this.userAddressesSubject.value;
    const updatedAddresses = currentAddresses.map(addr => ({
      ...addr,
      is_active: addr.id === activeAddressId
    }));
    this.userAddressesSubject.next(updatedAddresses);
  }

  private handleAddressError(error: any, operation: 'create' | 'update' | 'fetch'): void {
    if (error.status === 400) {
      this.toastr.error('Invalid address data', 'Validation Error');
    } else if (error.status === 401) {
      this.toastr.error('Please log in to manage addresses', 'Authentication Error');
    } else if (error.status === 404 && operation === 'fetch') {
      // Don't show error for empty address list
      console.log('ℹ️ No addresses found for user');
    } else if (error.status === 409) {
      this.toastr.error('Address already exists', 'Duplicate Error');
    } else if (error.status === 0) {
      this.toastr.error('Network error - check your connection', 'Network Error');
    } else {
      this.toastr.error(`Failed to ${operation} address`, 'Error');
    }
  }

  // ✅ Cache management
  private startCacheCleanup(): void {
    // Clean up cache every 5 minutes
    setInterval(() => {
      this.cleanupExpiredCacheEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, calculation] of this.shippingCalculationCache.entries()) {
      if (now - calculation.timestamp > this.CACHE_DURATION) {
        this.shippingCalculationCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  private cleanupOldCacheEntries(): void {
    // Remove oldest entries when cache is full
    const entries = Array.from(this.shippingCalculationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE + 10);
    toRemove.forEach(([key]) => {
      this.shippingCalculationCache.delete(key);
    });
    
    console.log(`🧹 Removed ${toRemove.length} old cache entries`);
  }

  // ✅ Clear all caches
  clearCache(): void {
    this.shippingCalculationCache.clear();
    this.addressDisplayCache.clear();
    this._cachedHeaders = null;
    console.log('🧹 All shipping caches cleared');
  }

  // ✅ Performance monitoring
  getCacheStats() {
    return {
      shippingCalculations: this.shippingCalculationCache.size,
      addressDisplays: this.addressDisplayCache.size,
      hasHeaderCache: !!this._cachedHeaders,
      loadingStates: { ...this.loadingStates }
    };
  }

  // ✅ Debug method for development
  debugShippingCalculation(methodId: number, cartTotal: number): void {
    const method = this.getShippingMethodById(methodId);
    if (!method) {
      console.log('❌ Method not found:', methodId);
      return;
    }

    console.group(`🔍 Shipping Calculation Debug`);
    console.log('Method:', method.name);
    console.log('Cart Total:', cartTotal);
    console.log('Base Cost:', method.base_cost);
    console.log('Free Shipping Threshold:', method.free_shipping_threshold);
    console.log('Qualifies for Free Shipping:', cartTotal >= method.free_shipping_threshold);
    console.log('Final Cost:', this.calculateShippingCost(methodId, cartTotal));
    console.groupEnd();
  }
}