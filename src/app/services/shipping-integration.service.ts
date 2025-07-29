// shipping-integration.service.ts - Final fixed version with proper TypeScript initialization
import { Injectable, OnDestroy } from '@angular/core';
import { Observable, combineLatest, BehaviorSubject, Subject, of } from 'rxjs';
import { map, takeUntil, debounceTime, distinctUntilChanged, shareReplay, startWith } from 'rxjs/operators';
import { CartService } from './cart.service';
import { ShippingService } from './shipping.service';
import { ShippingMethod } from '../models/order.model';

export interface ShippingCalculationResult {
  methodId: number;
  methodName: string;
  baseCost: number;
  finalCost: number;
  isFreeShipping: boolean;
  savings: number;
  estimatedDelivery: string;
}

export interface CheckoutSummary {
  subtotal: number;
  selectedShippingCost: number;
  tax: number;
  total: number;
  itemCount: number;
  shippingMethods: ShippingCalculationResult[];
  freeShippingProgress?: {
    threshold: number;
    current: number;
    remaining: number;
    percentage: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ShippingIntegrationService implements OnDestroy {
  private destroy$ = new Subject<void>();
  
  // ✅ Selected shipping method
  private selectedShippingMethodSubject = new BehaviorSubject<number | null>(null);
  selectedShippingMethod$ = this.selectedShippingMethodSubject.asObservable();

  // ✅ Tax rate (configurable)
  private taxRateSubject = new BehaviorSubject<number>(0.0875); // 8.75% default
  taxRate$ = this.taxRateSubject.asObservable();

  // ✅ SOLUTION 1: Using definite assignment assertion (!)
  // This tells TypeScript that these properties will be assigned before they're used
  shippingCalculations$!: Observable<ShippingCalculationResult[]>;
  checkoutSummary$!: Observable<CheckoutSummary>;

  // ✅ ALTERNATIVE SOLUTION 2: Direct initialization (uncomment to use instead)
  // shippingCalculations$: Observable<ShippingCalculationResult[]> = of([]);
  // checkoutSummary$: Observable<CheckoutSummary> = of({
  //   subtotal: 0,
  //   selectedShippingCost: 0,
  //   tax: 0,
  //   total: 0,
  //   itemCount: 0,
  //   shippingMethods: []
  // });

  constructor(
    private cartService: CartService,
    private shippingService: ShippingService
  ) {
    // ✅ Initialize observables immediately in constructor
    this.initializeStreams();
    this.setupCartIntegration();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeStreams(): void {
    // ✅ Calculate shipping costs for all methods when cart or shipping methods change
    this.shippingCalculations$ = combineLatest([
      this.cartService.subtotal$.pipe(startWith(0)),
      this.shippingService.shippingMethods$.pipe(startWith([]))
    ]).pipe(
      debounceTime(200), // Prevent excessive calculations
      map(([subtotal, methods]) => this.calculateAllShippingCosts(subtotal, methods)),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      shareReplay(1),
      takeUntil(this.destroy$)
    );

    // ✅ Complete checkout summary
    this.checkoutSummary$ = combineLatest([
      this.cartService.subtotal$.pipe(startWith(0)),
      this.cartService.cart$.pipe(startWith(0)),
      this.shippingCalculations$,
      this.selectedShippingMethod$,
      this.taxRate$
    ]).pipe(
      debounceTime(100),
      map(([subtotal, itemCount, shippingCalculations, selectedMethodId, taxRate]) => 
        this.calculateCheckoutSummary(subtotal, itemCount, shippingCalculations, selectedMethodId, taxRate)
      ),
      shareReplay(1),
      takeUntil(this.destroy$)
    );
  }

  private setupCartIntegration(): void {
    // ✅ Update shipping service when cart changes
    this.cartService.subtotal$.pipe(
      debounceTime(300), // Longer debounce for shipping service updates
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(subtotal => {
      this.shippingService.updateCartTotal(subtotal);
    });
  }

  private calculateAllShippingCosts(subtotal: number, methods: ShippingMethod[]): ShippingCalculationResult[] {
    if (!methods || methods.length === 0) {
      return [];
    }

    return methods.map(method => {
      const baseCost = method.base_cost || 0;
      const finalCost = this.shippingService.calculateShippingCost(method.id, subtotal, methods);
      const isFreeShipping = finalCost === 0 && baseCost > 0;
      const savings = isFreeShipping ? baseCost : 0;

      return {
        methodId: method.id,
        methodName: method.name || 'Shipping Method',
        baseCost,
        finalCost,
        isFreeShipping,
        savings,
        estimatedDelivery: method.estimated_delivery_days || '5-7 business days'
      };
    });
  }

  private calculateCheckoutSummary(
    subtotal: number,
    itemCount: number,
    shippingCalculations: ShippingCalculationResult[],
    selectedMethodId: number | null,
    taxRate: number
  ): CheckoutSummary {
    // ✅ Get selected shipping cost
    const selectedShipping = selectedMethodId 
      ? shippingCalculations.find(calc => calc.methodId === selectedMethodId)
      : null;
    
    const selectedShippingCost = selectedShipping?.finalCost || 0;
    
    // ✅ Calculate tax (on subtotal + shipping)
    const taxableAmount = subtotal + selectedShippingCost;
    const tax = Math.round(taxableAmount * taxRate * 100) / 100; // Round to 2 decimal places
    
    // ✅ Calculate total
    const total = Math.round((subtotal + selectedShippingCost + tax) * 100) / 100;

    // ✅ Calculate free shipping progress
    const freeShippingProgress = this.calculateFreeShippingProgress(subtotal);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      selectedShippingCost: Math.round(selectedShippingCost * 100) / 100,
      tax,
      total,
      itemCount: Math.max(0, itemCount),
      shippingMethods: shippingCalculations,
      freeShippingProgress
    };
  }

  private calculateFreeShippingProgress(cartTotal: number) {
    const threshold = this.shippingService.getLowestFreeShippingThreshold();
    
    if (threshold <= 0) return undefined;

    const remaining = Math.max(0, threshold - cartTotal);
    const percentage = Math.min(100, Math.max(0, (cartTotal / threshold) * 100));

    return {
      threshold: Math.round(threshold * 100) / 100,
      current: Math.round(cartTotal * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  // ✅ Public methods

  /**
   * Select a shipping method
   */
  selectShippingMethod(methodId: number): void {
    // ✅ Get current shipping methods and find the selected one
    this.shippingService.getShippingMethods().pipe(
      takeUntil(this.destroy$)
    ).subscribe(methods => {
      const method = methods.find(m => m.id === methodId);
      
      if (method) {
        this.selectedShippingMethodSubject.next(methodId);
        console.log(`🚚 Selected shipping method: ${method.name}`);
      } else {
        console.warn(`⚠️ Shipping method ${methodId} not found`);
      }
    });
  }

  /**
   * Get currently selected shipping method
   */
  getSelectedShippingMethod(): number | null {
    return this.selectedShippingMethodSubject.value;
  }

  /**
   * Clear selected shipping method
   */
  clearShippingSelection(): void {
    this.selectedShippingMethodSubject.next(null);
  }

  /**
   * Set tax rate
   */
  setTaxRate(rate: number): void {
    if (rate >= 0 && rate <= 1) { // Between 0% and 100%
      this.taxRateSubject.next(rate);
    } else {
      console.warn('Invalid tax rate. Must be between 0 and 1.');
    }
  }

  /**
   * Get tax rate
   */
  getTaxRate(): number {
    return this.taxRateSubject.value;
  }

  /**
   * Get shipping methods (public wrapper)
   */
  getShippingMethods(): Observable<ShippingMethod[]> {
    return this.shippingService.getShippingMethods();
  }

  /**
   * Get user addresses (public wrapper)
   */
  getUserAddresses(): Observable<any[]> {
    return this.shippingService.getUserShippingAddresses();
  }

  /**
   * Check if any shipping method offers free shipping for current cart
   */
  hasFreeShippingAvailable(): Observable<boolean> {
    return this.shippingCalculations$.pipe(
      map(calculations => calculations.some(calc => calc.isFreeShipping))
    );
  }

  /**
   * Get the cheapest shipping option
   */
  getCheapestShippingMethod(): Observable<ShippingCalculationResult | null> {
    return this.shippingCalculations$.pipe(
      map(calculations => {
        if (calculations.length === 0) return null;
        
        return calculations.reduce((cheapest, current) => 
          current.finalCost < cheapest.finalCost ? current : cheapest
        );
      })
    );
  }

  /**
   * Get shipping methods sorted by cost
   */
  getShippingMethodsSortedByCost(): Observable<ShippingCalculationResult[]> {
    return this.shippingCalculations$.pipe(
      map(calculations => [...calculations].sort((a, b) => a.finalCost - b.finalCost))
    );
  }

  /**
   * Auto-select cheapest shipping method
   */
  autoSelectCheapestShipping(): void {
    this.getCheapestShippingMethod().pipe(
      takeUntil(this.destroy$)
    ).subscribe(cheapest => {
      if (cheapest && !this.getSelectedShippingMethod()) {
        // Only auto-select if no method is currently selected
        this.selectShippingMethod(cheapest.methodId);
      }
    });
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  /**
   * Get savings text for free shipping
   */
  getSavingsText(calculation: ShippingCalculationResult): string {
    if (calculation.isFreeShipping && calculation.savings > 0) {
      return `You saved ${this.formatCurrency(calculation.savings)}!`;
    }
    return '';
  }

  /**
   * Get free shipping progress text
   */
  getFreeShippingProgressText(progress?: CheckoutSummary['freeShippingProgress']): string {
    if (!progress) return '';
    
    if (progress.remaining <= 0) {
      return 'You qualify for free shipping! 🎉';
    }
    
    return `Add ${this.formatCurrency(progress.remaining)} more for free shipping`;
  }

  /**
   * Reset all selections and cache
   */
  reset(): void {
    this.selectedShippingMethodSubject.next(null);
    this.shippingService.clearCache();
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      selectedMethod: this.selectedShippingMethodSubject.value,
      taxRate: this.taxRateSubject.value,
      cartSummary: this.cartService.getCartSummary(),
      shippingCache: this.shippingService.getCacheStats(),
      hasActiveSubscriptions: !this.destroy$.closed
    };
  }

  /**
   * Force refresh of shipping calculations
   */
  refreshShippingCalculations(): void {
    // Trigger a refresh by getting fresh data
    this.shippingService.getShippingMethods(true).pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  /**
   * Check if service is properly initialized
   */
  isInitialized(): boolean {
    return !!(this.shippingCalculations$ && this.checkoutSummary$);
  }
}