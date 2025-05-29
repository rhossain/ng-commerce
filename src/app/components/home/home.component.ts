import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHouse } from '@fortawesome/free-solid-svg-icons';
import { ProductSliderComponent } from "../../shared/product-slider/product-slider.component";
import { CategoryService } from '../../services/category.service';
import { ProductCategory } from '../../models/category.model';
import { FeaturedCategoryComponent } from "../../product/featured-category/featured-category.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FontAwesomeModule, ProductSliderComponent, FeaturedCategoryComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export default class HomeComponent {
  categories: ProductCategory[] = [];
  selectedCategoryId: number | null = null;
  
  faHouse = faHouse;

  constructor (
      private route: ActivatedRoute, 
      private router: Router, 
      private categoryService: CategoryService
  ) {}

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
