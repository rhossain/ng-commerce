import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { CategoryService } from '../../services/category.service';
import { ProductCategory } from '../../models/category.model';
import { ProductService } from '../../services/product.service';

interface CategoryWithCount extends ProductCategory {
  productCount: number;
}

@Component({
  selector: 'app-featured-category',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './featured-category.component.html',
  styleUrl: './featured-category.component.scss'
})
export class FeaturedCategoryComponent {
  @Input() styleType: 'default' | 'grid' | 'pill' | 'sidebar' = 'default';
  @Input() selectedCategoryId!: number | null;
  @Input() onlyCategoryIds?: number[];
  @Input() categories: CategoryWithCount[] = [];

  @Output() categorySelected = new EventEmitter<number | null>();

  loading = true;
  
  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private categoryService: CategoryService,
    private productService: ProductService
  ) {}

  selectCategory(id: number | null): void {
    this.categorySelected.emit(id);
  }

  onCategorySelect(categoryId: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { categoryId, page: 1 }, // reset to page 1
      queryParamsHandling: 'merge'
    });
  }  

  ngOnInit(): void {
    // this.categoryService.getAllCategories().subscribe((res) => {
    //   // ✅ Filter only if onlyCategoryIds is a non-empty array
    //   // console.log(this.categories);
    //   if (Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0) {
    //     this.categories = res.filter(c => this.onlyCategoryIds!.includes(c.id));
    //   } else {
    //     this.categories = res;
    //   }
    // });
    this.loadCategoriesWithCounts();
  }

  loadCategoriesWithCounts(): void {
    forkJoin([
      this.categoryService.getAllCategories(),
      this.productService.getProducts(1, 100) // Get first page with large perPage to get all products
    ]).pipe(
      map(([categories, productResponse]) => {
        // Use productResponse.items instead of productResponse.products
        const products = productResponse.items;
        
        // Filter categories if onlyCategoryIds is provided
        let filteredCategories = categories;
        if (Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0) {
          filteredCategories = categories.filter(c => this.onlyCategoryIds!.includes(c.id));
        }
        
        // Add product counts to each category
        return filteredCategories.map(category => ({
          ...category,
          productCount: products.filter(
            product => product.category_id === category.id
          ).length
        }));
      })
    ).subscribe({
      next: (categoriesWithCounts) => {
        this.categories = categoriesWithCounts;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.loading = false;
      }
    });
  }
}
