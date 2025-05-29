import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrModule } from 'ngx-toastr';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { FeaturedCategoryComponent } from "../featured-category/featured-category.component";
import ListComponent from "../list/list.component";

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [FormsModule, ToastrModule, FeaturedCategoryComponent, ListComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss'
})
export default class ShopComponent implements OnInit, OnChanges {
  price: number = 100;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  totalProducts: number = 0;
  searchQuery: string = '';
  categoryId: number | null = null;
  selectedCategoryId: number | null = null;
  currentPage = 1;
  sortBy: string = 'id';
  orderBy: 'asc' | 'desc' = 'asc';

  categories: ProductCategory[] = [];

  constructor (
    private route: ActivatedRoute, 
    private router: Router, 
    private categoryService: CategoryService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    throw new Error('Method not implemented.');
  }
  
  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.selectedCategoryId = params['categoryId'] ? +params['categoryId'] : null;
      this.minPrice = params['minPrice'] ? +params['minPrice'] : null;
      this.maxPrice = params['maxPrice'] ? +params['maxPrice'] : null;
    });

    this.loadCategories();
  }

  onPriceChange(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        minPrice: this.minPrice,
        maxPrice: this.maxPrice,
        page: 1 // Reset page when filtering
      },
      queryParamsHandling: 'merge'
    });
  }  

  productCountChanged(count: number) {
    this.totalProducts = count;
  }

  onSearchSubmit() {
    this.router.navigate(['/product/search'], {
      queryParams: {query: this.searchQuery},
    })
  }

  filterByCategory(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    this.updateQueryParams({ categoryId });
  }  

  onSortChange(sortBy: string, orderBy: 'asc' | 'desc') {
    this.sortBy = sortBy;
    this.orderBy = orderBy;
    this.updateQueryParams({ sortBy, orderBy });
  }
  
  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateQueryParams({ page });
  }  

  updateQueryParams(params: { [key: string]: any }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge', // preserves other query params
    });
  } 
  
  loadCategories(): void {
    // If using a service:
    this.categoryService.getAllCategories().subscribe((res) => {
      this.categories = res;
    });
  }

  onCategorySelect(categoryId: number | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        categoryId: categoryId ?? null,
        page: 1
      },
      queryParamsHandling: 'merge'
    });
  }
}
