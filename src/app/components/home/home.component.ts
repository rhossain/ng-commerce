import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MdbTabsModule } from 'mdb-angular-ui-kit/tabs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faHouse } from '@fortawesome/free-solid-svg-icons';
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
  imports: [CommonModule, MdbTabsModule, FontAwesomeModule, ProductSliderComponent, FeaturedCategoryComponent, ShowcaseComponent, DealCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export default class HomeComponent {
  categories: ProductCategory[] = [];
  selectedCategoryId: number | null = null;
  deal1 = Date.now() + 10 * 60 * 60 * 1000; // 2 hours from now
  
  faHouse = faHouse;

  constructor (
      private route: ActivatedRoute, 
      private router: Router, 
      private categoryService: CategoryService,
      public routeUtils: RouteUtilsService
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
