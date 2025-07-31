import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHouse } from '@fortawesome/free-solid-svg-icons';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { ProductSliderComponent } from "../../shared/product-slider/product-slider.component";
import { CategoryService } from '../../services/category.service';
import { ProductCacheService } from '../../services/product-cache.service';
import { ProductCategory } from '../../models/category.model';
import { FeaturedCategoryComponent } from "../../product/featured-category/featured-category.component";
import { RouteUtilsService } from '../../services/route-utils.service';
import { CommonModule } from '@angular/common';
import { ShowcaseComponent } from "../../product/showcase/showcase.component";
import { DealCardComponent } from "../../product/deal-card/deal-card.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    FontAwesomeModule, 
    NgbNavModule, 
    ProductSliderComponent, 
    FeaturedCategoryComponent, 
    ShowcaseComponent, 
    DealCardComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export default class HomeComponent implements OnInit, OnDestroy {
  categories: ProductCategory[] = [];
  selectedCategoryId: number | null = null;
  isLoading = true;
  error: string | null = null;
  cacheLoaded = false;
  
  // ADD ONLY THIS: A simple flag to control when slider shows
  showSlider = false;
  
  faHouse = faHouse;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute, 
    private router: Router, 
    private categoryService: CategoryService,
    private productCacheService: ProductCacheService,
    public routeUtils: RouteUtilsService
  ) {}

  ngOnInit(): void {
    console.log('HomeComponent ngOnInit called');
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Make it wait for cache before showing slider
  private async initializeComponent(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this.showSlider = false; // Ensure slider is hidden initially
    
    try {
      // Load categories first
      await this.loadCategories();
      
      // Then preload cache
      await this.preloadProductCache();
      
      this.setupRouteListening();
      this.isLoading = false;
      
      // Only show slider after everything is ready
      this.showSlider = true;
      
      console.log('HomeComponent: Initialization complete');
    } catch (error) {
      console.error('HomeComponent: Initialization failed:', error);
      this.error = 'Failed to load page data';
      this.isLoading = false;
      this.showSlider = false;
    }
  }

  // KEEP ALL YOUR EXISTING METHODS EXACTLY AS THEY ARE
  private async loadCategories(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.categoryService.getAllCategories()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (categories) => {
            console.log('HomeComponent: Categories loaded:', categories.length);
            this.categories = categories;
            resolve();
          },
          error: (error) => {
            console.error('HomeComponent: Error loading categories:', error);
            reject(error);
          }
        });
    });
  }

  private async preloadProductCache(): Promise<void> {
    try {
      console.log('HomeComponent: Preloading product cache...');
      await this.productCacheService.ensureCache();
      this.cacheLoaded = true;
      console.log('HomeComponent: Product cache loaded successfully');
    } catch (error) {
      console.error('HomeComponent: Failed to preload product cache:', error);
      this.cacheLoaded = false;
    }
  }

  private setupRouteListening(): void {
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const categoryId = params.get('categoryId');
        this.selectedCategoryId = categoryId ? +categoryId : null;
        console.log('HomeComponent: Selected category ID from route:', this.selectedCategoryId);
      });
  }

  onCategorySelect(categoryId: number | null): void {
    console.log('HomeComponent: Category selected:', categoryId);
    this.selectedCategoryId = categoryId;
    
    if (categoryId) {
      this.router.navigate(['/shop'], {
        queryParams: {
          categoryId: categoryId,
          page: 1
        }
      });
    } else {
      this.router.navigate(['/shop'], {
        queryParams: {
          page: 1
        }
      });
    }
  }

  retry(): void {
    console.log('HomeComponent: Retrying initialization...');
    this.showSlider = false; // Reset slider flag
    this.initializeComponent();
  }

  getCacheStatus(): string {
    const info = this.productCacheService.getCacheInfo();
    return `Products: ${info.productCount}, Valid: ${info.isValid}, Loading: ${info.isLoading}`;
  }

  refreshCache(): void {
    console.log('HomeComponent: Force refreshing cache...');
    this.productCacheService.forceRefresh()
      .then(() => {
        console.log('HomeComponent: Cache refreshed successfully');
        this.cacheLoaded = true;
      })
      .catch(error => {
        console.error('HomeComponent: Cache refresh failed:', error);
      });
  }

  shouldShowComponents(): boolean {
    return !this.isLoading && !this.error;
  }

  shouldShowLoading(): boolean {
    return this.isLoading;
  }

  shouldShowError(): boolean {
    return !this.isLoading && this.error != null;
  }

  getCacheStatistics() {
    return this.productCacheService.getProductStatistics();
  }

  logCacheStats(): void {
    const stats = this.getCacheStatistics();
    console.log('Cache Statistics:', stats);
  }
}