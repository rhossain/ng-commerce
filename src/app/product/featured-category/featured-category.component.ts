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
  @Input() styleType: 'default' | 'list' | 'grid' | 'pill' | 'sidebar' = 'default';
  @Input() selectedCategoryId!: number | null;
  @Input() onlyCategoryIds?: number[];
  @Input() categories: ProductCategory[] = [];

  @Output() categorySelected = new EventEmitter<number | null>();

  fallbackImg = 'assets/images/image-not-loaded.jpg';
  
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
    this.categorySelected.emit(categoryId);
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
    forkJoin({
      categories: this.categoryService.getAllCategories(),
      counts: this.categoryService.getCategoryProductCounts()
    }).subscribe(({ categories, counts }) => {
      const countMap = new Map<number, number>();
      counts.forEach(c => countMap.set(c.category_id, c.count));

      const filtered = Array.isArray(this.onlyCategoryIds) && this.onlyCategoryIds.length > 0
        ? categories.filter(c => this.onlyCategoryIds!.includes(c.id))
        : categories;

      this.categories = filtered.map(cat => ({
        ...cat,
        productCount: countMap.get(cat.id) || 0
      }));
    });
  }
}
