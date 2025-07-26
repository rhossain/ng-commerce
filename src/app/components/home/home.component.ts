import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHouse } from '@fortawesome/free-solid-svg-icons';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { ProductSliderComponent } from "../../shared/product-slider/product-slider.component";
import { CategoryService } from '../../services/category.service';
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
  
  faHouse = faHouse;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute, 
    private router: Router, 
    private categoryService: CategoryService,
    public routeUtils: RouteUtilsService
  ) {}

  ngOnInit(): void {
    console.log('HomeComponent ngOnInit called');
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.error = null;
    
    // Load categories for the featured category component
    this.categoryService.getAllCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          console.log('Categories loaded in HomeComponent:', categories);
          this.categories = categories;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading categories in HomeComponent:', error);
          this.error = 'Failed to load page data';
          this.isLoading = false;
        }
      });

    // Listen to route params for category selection
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const categoryId = params.get('categoryId');
        this.selectedCategoryId = categoryId ? +categoryId : null;
        console.log('Selected category ID from route:', this.selectedCategoryId);
      });
  }

  onCategorySelect(categoryId: number | null): void {
    console.log('Category selected in HomeComponent:', categoryId);
    this.selectedCategoryId = categoryId;
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        categoryId: categoryId ?? null,
        page: 1
      },
      queryParamsHandling: 'merge'
    });
  }

  // Helper method to retry loading data
  retry(): void {
    this.loadInitialData();
  }
}