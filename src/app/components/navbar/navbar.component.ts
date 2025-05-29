import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faListUl } from '@fortawesome/free-solid-svg-icons';
import { ProductCategory } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { RouteUtilsService } from '../../services/route-utils.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  faListUl = faListUl;

  categories: ProductCategory[] = [];
  initialVisibleCount = 6;
  showAll = false;
  currentUrl$;
  isHomePage$;

  constructor(
    private categoryService: CategoryService,
    public routeUtils: RouteUtilsService
  ) {
    this.currentUrl$ = this.routeUtils.currentUrl$;
    this.isHomePage$ = this.routeUtils.isCurrentRoute('/home');
  }

  ngOnInit(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (data) => this.categories = data,
      error: (err) => console.error('Failed to load categories', err)
    });
    console.log(this.categories);
  }

  getVisibleCategories(): ProductCategory[] {
    return this.showAll ? this.categories : this.categories.slice(0, this.initialVisibleCount);
  }
  
  toggleShowAll() {
    this.showAll = !this.showAll;
  }
}
